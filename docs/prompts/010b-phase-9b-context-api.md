# Phase 9b: Context Management API

Read `docs/coding-agent-plan.md` and `docs/progress.md` for full context. Phases 8a, 8b, and 9a must be complete before starting this.

## Task

Add server-side REST endpoints and WebSocket broadcasting for context management. This makes context operations available to both the agent (via HTTP) and the UI (via REST + WebSocket updates).

## New REST Endpoints

### PATCH /api/messages/:id/context-status
- Body: `{ status: "active" | "inactive" }`
- Update message's `contextStatus`
- If setting to 'active' and message was 'summarized', also delete the associated summary (restore)
- Broadcast `context:updated` to both agent and UI WebSockets
- Broadcast `context:status` (token counts) to UI
- Return 200

### POST /api/sessions/:id/summaries
- Body: `{ content: string, messageIds: string[], createdBy: "agent" | "user" }`
- Validate Rule 2: all target messages must have `contextStatus = 'active'`
- Validate Rule 1: no target message already belongs to a summary
- Set `position_at` to the earliest `created_at` among the target messages
- Create summary row + summary_messages join table entries
- Set all target messages to `contextStatus = 'summarized'`
- Broadcast `summary:created` (with full summary object) to both agent and UI
- Broadcast `context:status` (token counts) to UI
- Return 201 with the created summary

### DELETE /api/summaries/:id
- Find the summary and its associated messages via the join table
- Set all associated messages back to `contextStatus = 'active'`
- Delete the summary_messages entries and summary row
- Broadcast `summary:deleted` (with summaryId and restored messageIds) to both agent and UI
- Broadcast `context:status` (token counts) to UI
- Return 200

### GET /api/sessions/:id/context
- Return context status: list of messages with their contextStatus and tokenCount, total used tokens, max tokens (from `LLM_MAX_TOKENS` env var or default 128000)
- Used by both agent (context tool) and UI (context gauge)

## WebSocket Broadcasting Helpers

Add broadcast functions:
- `broadcastContextUpdated(sessionId, messageIds, contextStatus)` — send to both agent and UI
- `broadcastSummaryCreated(sessionId, summary)` — send full summary object to both agent and UI
- `broadcastSummaryDeleted(sessionId, summaryId, restoredMessageIds)` — send to both agent and UI
- `broadcastContextStatus(sessionId)` — send token counts to UI only

## Session Response Update

Update the existing `GET /api/sessions/:id` endpoint to include summaries in the response alongside messages. This allows the UI to render summarized messages without a separate fetch.

## Incremental Tests

Add integration tests for:
- **PATCH context-status:** Change a message from active to inactive → verify DB update, verify GET context reflects change
- **PATCH context-status:** Change from inactive back to active → verify
- **POST summaries:** Create a summary over 3 active messages → verify:
  - Summary created with correct position_at
  - All 3 messages now have contextStatus = 'summarized'
  - GET context token count reflects the change
- **POST summaries validation:** Try to summarize an inactive message → 400 error
- **POST summaries validation:** Try to summarize an already-summarized message → 400 error
- **DELETE summary:** Delete a summary → verify messages restored to active, summary gone from DB
- **GET context:** Verify it returns correct token counts and message states
- **Session response:** Verify GET /api/sessions/:id includes summaries
- Existing tests still pass

## Verification

1. `pnpm build` succeeds
2. All new tests pass
3. All existing tests pass
4. Can manually test via curl: create session + messages, PATCH context status, create summary, restore

## On Completion

Update `docs/progress.md`. Commit with message: "Phase 9b — context management API"
