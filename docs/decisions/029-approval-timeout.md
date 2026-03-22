# Approval Timeout Policy
**Status:** Accepted
**Date:** 2026-03-21
**Source:** [Conversation 006](../conversations/006-code-audit-and-remediation-planning.md)

## Context

When the agent requests approval for a consequential tool call (`bash`, `write_file`), it blocks on a promise until the user responds. If the user walks away, closes the browser, or simply doesn't notice, the agent hangs indefinitely. The approval resolver stays in memory forever — a slow leak that also prevents the agent from doing any other work.

The session:stop handler already cleaned up pending approvals (added in Phase 13), but there was no timeout for the normal case where the session is still active.

## Decision

Add a configurable timeout to `waitForApproval()`:

- **Default timeout:** 5 minutes (`APPROVAL_TIMEOUT_MS` env var)
- **On timeout:** Auto-reject the tool call and continue the agent loop
- **Behavior:** The LLM receives a rejection result and can decide how to proceed (retry, ask the user, or give up)

Auto-reject (rather than auto-approve) is the safe default — a timed-out approval should not execute a potentially destructive command. The timeout is long enough for a user to read, think, and decide, but short enough to prevent indefinite blocking.

## Consequences

- Agent never hangs indefinitely on a missing approval
- Approval resolvers are cleaned up by the timeout, preventing memory leaks
- The LLM sees a rejection and can adapt (e.g., "I tried to run this command but it was rejected — would you like me to try a different approach?")
- Users who step away briefly (< 5 min) can still approve; longer absences result in auto-rejection
- Timeout is configurable via `APPROVAL_TIMEOUT_MS` for deployments that need different behavior
- `ask_human` tool also benefits from the same timeout — if the user doesn't respond, the agent gets an empty response rather than hanging
