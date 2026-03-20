# Flat Message Model for Tool Calls
**Status:** Accepted
**Date:** 2026-03-19
**Source:** [Conversation 002](../conversations/002-coding-agent-design.md)

## Context

With tools, a single user message can trigger a multi-step sequence: thinking → text → tool call → tool result → more text → another tool call → ... → final response. This is a loop, not a single pass. We needed a model that's simple to implement, troubleshoot, and expose in the UI.

We considered separate "turn" or "step" entities but chose to flatten everything into the existing message model.

## Decision

Every step in the tool loop is a message in the same `messages` table. A turn becomes a sequence of messages:

```
user message          (role: user)
assistant text        (role: assistant)
tool call             (role: tool_call)
tool result           (role: tool_result)
assistant text        (role: assistant)
```

The `Message` type expands with new fields:
- `role` adds `tool_call` and `tool_result` values
- `toolName` — which tool (for tool_call and tool_result)
- `toolArgs` — arguments as JSON (for tool_call)
- `toolCallId` — links a tool_result to its tool_call
- `contextStatus` — active/summarized/inactive
- `approvalStatus` — none/pending/approved/rejected (for tool calls needing approval)
- `tokenCount` — estimated token count

All messages share a `sessionId` and are ordered by `createdAt`.

## Consequences

- One table, one concept — messages. No joins needed for the basic flow
- The UI maps over the message list and renders each type with its own component
- Context management works identically for all message types — any message can be dropped or summarized
- Approval is a field on a tool_call message, not a separate entity
- Tool results from large file reads are just messages that can be individually dropped to save context
- Translation to/from Vercel AI SDK message format happens at LLM call time
- The database schema is wider (more nullable columns) but not more complex
