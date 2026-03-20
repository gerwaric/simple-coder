# Phase 9: Server API + Protocol

Read `docs/coding-agent-plan.md` and `docs/progress.md` for full context.

## Task

Add server-side support for tool approval, context management, and the new WebSocket message types. The server becomes the broker for approval decisions and context state changes.

## New REST Endpoints (packages/server/src/routes/sessions.ts or new routes file)

### POST /api/tools/:toolCallId/approve
- Find the tool_call message by `toolCallId` (not message row ID)
- Verify it has `approvalStatus = 'pending'`
- Update `approvalStatus` to `'approved'`
- Send `tool:approval:response` to the agent via WebSocket (approved: true)
- Broadcast update to UI
- Return 200

### POST /api/tools/:toolCallId/reject
- Same as approve but sets `approvalStatus = 'rejected'`
- Send `tool:approval:response` to the agent (approved: false)
- Broadcast update to UI
- Return 200

### POST /api/tools/:toolCallId/respond
- For `ask_human` tool calls
- Body: `{ response: string }`
- Find tool_call message by `toolCallId`
- Update `approvalStatus` to `'approved'`
- Send `tool:approval:response` to agent with the response text
- Broadcast update to UI
- Return 200

### POST /api/sessions/:id/summaries
- Body: `{ content: string, messageIds: string[], createdBy: "agent" | "user" }`
- Validate Rule 2: all target messages must have `contextStatus = 'active'`
- Validate Rule 1: no target message already belongs to a summary
- Set `position_at` to the earliest `created_at` among the target messages
- Create summary row + summary_messages join table entries
- Set all target messages to `contextStatus = 'summarized'`
- Broadcast `summary:created` (with full summary object) to both agent and UI
- Return 201 with the created summary

### DELETE /api/summaries/:id
- Find the summary and its associated messages via the join table
- Set all associated messages back to `contextStatus = 'active'`
- Delete the summary_messages entries and summary row
- Broadcast `summary:deleted` (with summaryId and restored messageIds) to both agent and UI
- Return 200

### PATCH /api/messages/:id/context-status
- Body: `{ status: "active" | "inactive" }`
- Update message's `contextStatus`
- If setting to 'active' and message was 'summarized', also delete the associated summary (restore)
- Broadcast `context:updated` to both agent and UI WebSockets
- Return 200

### GET /api/sessions/:id/context
- Return context status: list of messages with their contextStatus and tokenCount, total used tokens, max tokens
- Used by both agent (context tool) and UI (context gauge)

## WebSocket Handler Updates (packages/server/src/ws/agent-ws.ts)

Handle new agent → server message types. Each tool call follows exactly ONE persistence path — either `tool:call` (safe, already executed) or `tool:approval:request` (needs approval). Never both.

### tool:call (update existing placeholder)
- Persist tool call message with agent-provided ID and toolCallId (no approval — agent already executed it)
- Broadcast to UI for display

### tool:approval:request
- Persist the tool call message with `approvalStatus = 'pending'` (this is the only persistence for this tool call)
- Broadcast `tool:approval:request` to UI WebSocket
- Do NOT send a response to the agent yet — the agent is waiting

### tool:result (update existing placeholder)
- Persist tool result message, linked to its tool_call via toolCallId
- Broadcast to UI for display

## WebSocket Broadcasting

Add broadcast helpers:
- `broadcastContextUpdated(sessionId, messageIds, contextStatus)` — send to both agent and UI (for drop/activate)
- `broadcastSummaryCreated(sessionId, summary)` — send full summary object to both agent and UI
- `broadcastSummaryDeleted(sessionId, summaryId, restoredMessageIds)` — send to both agent and UI
- `broadcastContextStatus(sessionId)` — send token counts to UI

## Token Counting Utility

Create a simple token estimation function:
```typescript
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

Used when persisting messages (set tokenCount) and when computing context status.

## Session Response Update

Update the existing `GET /api/sessions/:id` endpoint to include summaries in the response alongside messages. This allows the UI to render summarized messages without a separate fetch.

## Verification

1. `pnpm build` succeeds
2. Start server + Postgres
3. Create a session and message via existing API
4. `curl -X PATCH` to change a message's context status — verify it updates in DB
5. `curl GET /api/sessions/:id/context` — verify token counts return
6. Verify existing tests still pass

## On Completion

Update `docs/progress.md`. Commit with message: "Phase 9 — server API for approval and context management"
