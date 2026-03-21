# Real Database IDs for Tool Messages
**Status:** Accepted
**Date:** 2026-03-20
**Source:** [Conversation 005](../conversations/005-phase-13-testing-and-ui-polish.md)

## Context
Tool messages in the UI were assigned synthetic IDs: tool_call messages used the `toolCallId` as their message ID, and tool_result messages used `${toolCallId}-result`. When the UI tried to set context status on these messages via `PATCH /api/messages/:id/context-status`, the server rejected the synthetic IDs because they weren't valid UUIDs (especially the `-result` suffix).

## Decision
Include the real database-assigned message ID (`messageId`) in all tool-related WebSocket broadcasts from the server: `tool:call`, `tool:result`, and `tool:approval:request`. The UI uses the real `messageId` when available, falling back to the synthetic ID only if the server doesn't provide one (backwards compatibility).

## Consequences
- Context status operations on tool messages now work correctly — the server receives valid UUIDs
- The WebSocket message types gain an optional `messageId` field (backwards-compatible addition)
- The server captures the return value of `createMessage` for tool messages, which was previously discarded
- The synthetic ID fallback ensures the UI doesn't break if an older server version doesn't include `messageId`
