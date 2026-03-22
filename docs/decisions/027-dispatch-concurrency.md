# Session Dispatch Concurrency
**Status:** Accepted
**Date:** 2026-03-21
**Source:** [Conversation 006](../conversations/006-code-audit-and-remediation-planning.md)

## Context

`dispatchPendingSessions()` had a time-of-check/time-of-use race condition. Two concurrent calls (e.g., triggered by two users creating sessions simultaneously, or an agent becoming ready while a session is also created) could both find the same idle agent via `getIdleAgent()` and assign it two sessions. The second assignment would silently overwrite the first, losing a session.

The root cause was a two-phase check-then-act pattern across two state stores: in-memory agent connections and the Postgres sessions table. Neither was locked during the gap between checking and claiming.

## Decision

Fix with a two-layer reservation pattern:

1. **In-memory reservation:** `reserveIdleAgent()` atomically finds an idle agent and sets a sentinel value (`"__reserving__"`) on its `currentSessionId`. Since Node.js is single-threaded, this is atomic within a single event loop tick. A reserved agent won't be returned by subsequent `reserveIdleAgent()` calls.

2. **Database-level locking:** `SELECT ... FOR UPDATE SKIP LOCKED` atomically claims the oldest pending session. `SKIP LOCKED` ensures concurrent dispatches don't block each other — if another transaction has already locked a row, it's skipped.

3. **Rollback on failure:** If no pending session is found or the DB operation fails, `unreserveAgent()` clears the sentinel and returns the agent to the idle pool.

Alternatives considered:
- **Advisory locks:** More complex, harder to reason about, overkill for single-process server.
- **Queue table:** Over-engineered for this use case. The sessions table already serves as the queue.
- **Serialize all dispatches through a single async queue:** Would work but adds latency and complexity.

## Consequences

- Concurrent dispatches are safe: each agent is claimed at most once per dispatch cycle
- `SKIP LOCKED` means no blocking — dispatches that lose the race simply find no pending session and exit
- The sentinel value (`"__reserving__"`) is an implementation detail that doesn't leak into the protocol or database
- `getIdleAgent()` is preserved for read-only use (e.g., checking if any agent is available) but dispatch always goes through `reserveIdleAgent()`
