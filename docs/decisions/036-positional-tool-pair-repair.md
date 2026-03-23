# Positional Repair of Orphaned Tool Pairs
**Status:** Accepted
**Date:** 2026-03-22
**Source:** [Conversation 010](../conversations/010-orphan-tool-fix-and-demo-planning.md)

## Context

When the agent crashes, disconnects, or is interrupted mid-tool-loop, the message history can contain mismatched `tool_use`/`tool_result` pairs. The Anthropic API enforces strict positional pairing: each `tool_result` must reference a `tool_use` in the immediately preceding assistant message, and each `tool_use` must have a corresponding `tool_result` immediately after. Violations cause `invalid_request_error`, making sessions unrecoverable.

Initial fix attempts used global ID matching (collecting all tool-call IDs across all assistant messages). This failed because the API validates positionally — a `tool_result` referencing a `tool_use` that exists in a *different* assistant message is still rejected.

## Decision

The `toSdkMessages` translator in `packages/agent/src/message-translator.ts` performs a positional repair pass after building the SDK message array. It handles both directions:

1. **Orphan tool results:** For each `tool` role message, find the immediately preceding assistant message (skipping other tool messages in the same group). Drop any tool-result parts whose IDs don't match a tool-call in that specific assistant message.

2. **Orphan tool calls:** For each assistant message with tool-call parts, check that the immediately following tool messages contain matching results. Inject synthetic "Tool call was interrupted — no result available" results for any unmatched calls.

The repair scans in reverse so splice operations don't invalidate indices.

## Consequences

- **Sessions are recoverable** after agent crashes or disconnects mid-tool-loop. The LLM sees synthetic "interrupted" results and can continue normally.
- **No database changes** — repair happens at translation time, not in stored data. The orphaned messages remain in the database as-is.
- **Slight risk:** If a tool result is misplaced (valid but in the wrong position), it will be dropped rather than relocated. This is acceptable because the scenario only occurs during crash recovery, and the synthetic result gives the LLM enough information to proceed.
- **Warn-level logging** when repairs are applied, for operational visibility.
