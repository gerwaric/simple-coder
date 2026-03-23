# Known Issues

## Orphaned Tool Calls in Message History

**Severity:** High — can make a session permanently unusable
**Discovered:** [Conversation 009](conversations/009-bug-fixes-and-rate-limit-handling.md)

When the agent crashes, disconnects, or is interrupted mid-tool-loop (e.g., by hot reload or rate limiting), the message history can end up with a `tool_use` block without a matching `tool_result`. The Anthropic API rejects this with `invalid_request_error`, making the session unrecoverable.

**Potential fix:** The `toSdkMessages` translator in `packages/agent/src/message-translator.ts` could detect unpaired tool calls at the end of the history and either inject a synthetic "tool call was interrupted" result or drop the orphan.

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
