# Turn-Complete Idle Signaling
**Status:** Accepted
**Date:** 2026-03-20
**Source:** [Conversation 004](../conversations/004-debugging-ui-and-agent-lifecycle.md)

## Context

After the agent completed its tool loop (LLM responded with text, no more tool calls), it never notified the server. The server tracked agent availability via `currentSessionId` — non-null meant busy. Without a completion signal, the server permanently considered the agent busy, so new sessions were never dispatched.

The symptom was that the first session worked, but creating a second session resulted in no agent response. The session stayed in `pending` state indefinitely.

We considered using the existing `session:completed` message, but that was wrong — it sets the session state to `completed`, which would prevent follow-up messages to the same session. The agent needs to signal "I'm done with this turn" without closing the session.

## Decision

Added a new `turn:complete` WebSocket message type. The agent sends `turn:complete` after `runToolLoop` returns (both for `session:assign` and `user:message` handlers). The server handles it by:

1. Clearing the agent's `currentSessionId` (marking it idle)
2. Calling `dispatchPendingSessions` to assign any waiting sessions

For follow-up messages to sessions whose agent was released: the server's message route now detects when no agent is assigned, sets the session back to `pending`, and calls `dispatchPendingSessions`. The agent receives the full session history via the normal `session:assign` flow.

Alternatives considered:
- **`session:completed`** — wrong because it ends the session permanently
- **Keep agent assigned, block new sessions** — single-agent bottleneck, unacceptable UX
- **Agent sends `agent:ready` after each turn** — semantically incorrect (ready implies no session context), and wouldn't preserve the option for the server to keep the agent assigned in the future

## Consequences

- Sessions now cycle through `pending → active → (agent released) → pending → active` on follow-up messages after idle release
- The agent loses in-memory message history when re-dispatched to the same session (server resends full history from DB, which is correct but slightly more overhead)
- Single-agent deployments can now serve multiple sessions sequentially
- The protocol change requires both agent and server to be updated together (backward-incompatible)
