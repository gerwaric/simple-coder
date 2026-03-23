# Known Issues

## ~~Orphaned Tool Calls in Message History~~ (Fixed)

**Severity:** High — could make a session permanently unusable
**Discovered:** [Conversation 009](conversations/009-bug-fixes-and-rate-limit-handling.md)
**Fixed:** Conversation 010

When the agent crashes, disconnects, or is interrupted mid-tool-loop (e.g., by hot reload or rate limiting), the message history can end up with mismatched `tool_use`/`tool_result` pairs. The Anthropic API requires strict positional pairing: each `tool_result` must reference a `tool_use` in the immediately preceding assistant message, and vice versa.

**Fix:** The `toSdkMessages` translator in `packages/agent/src/message-translator.ts` now repairs both directions: orphaned `tool_use` blocks get synthetic "interrupted" results injected, and orphaned `tool_result` blocks referencing non-existent calls are dropped. Validation is positional (checks the immediately preceding assistant message), not global.

## Disconnect Recovery Only Handles One Session

**Severity:** Low — only occurs if an agent is somehow assigned multiple sessions
**Discovered:** [Conversation 009](conversations/009-bug-fixes-and-rate-limit-handling.md)

`removeAgent()` in `packages/server/src/ws/connections.ts` returns a single `currentSessionId`. If an agent somehow has two active sessions (which shouldn't happen but was observed), only one gets recovered to `pending` on disconnect. The other remains stuck in `active` state with a dead agent.

**Potential fix:** Query the database for all sessions assigned to the disconnecting agent and reset them all to `pending`.

## Non-Rate-Limit Errors Lack Detail in UI

**Severity:** Low — cosmetic/UX
**Discovered:** [Conversation 009](conversations/009-bug-fixes-and-rate-limit-handling.md)

When the LLM stream encounters a non-rate-limit error, the UI shows "LLM error — aborting current turn" with no detail about what went wrong. The error is logged to the agent console but not surfaced to the user.

**Potential fix:** Include a summary of the error message in the `agent:warning` payload.
