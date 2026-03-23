# Context Status Broadcast on Agent Messages
**Status:** Accepted
**Date:** 2026-03-22
**Source:** [Conversation 009](../conversations/009-bug-fixes-and-rate-limit-handling.md)

## Context
The UI's token count gauge only updated when the user performed context management actions (drop/restore messages, create/delete summaries). During normal agent operation — assistant responses, tool calls, tool results — the token count stayed stale because `broadcastContextStatus()` was never called from the agent WebSocket handler.

## Decision
Added `broadcastContextStatus()` calls in `agent-ws.ts` after each message-creating event: `assistant:message:complete`, `tool:call`, `tool:result`, and `tool:approval:request`. A local `refreshContextStatus()` helper queries the database for current token usage and broadcasts to UI clients.

## Consequences
- The UI token gauge now updates in real-time as the agent works
- Adds one additional database query per agent message (the `getContextStatus` query), which is lightweight
- Consistent with how the context routes already broadcast after user-initiated actions
