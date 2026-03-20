# Phase 9a: Tool Approval API + Protocol

Read `docs/coding-agent-plan.md` and `docs/progress.md` for full context. Phase 8a must be complete before starting this. Phase 8b is NOT required — tool approval is independent of context management.

## Task

Add server-side support for tool call persistence and the approval flow. The server becomes the broker for approval decisions. Context management endpoints come in 9b.

## New REST Endpoints

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

## Incremental Tests

Add integration tests for:
- **tool:call persistence:** Simulate agent sending `tool:call` → verify message persisted with correct toolName, toolArgs, toolCallId
- **tool:result persistence:** Simulate agent sending `tool:result` → verify message persisted and linked via toolCallId
- **tool:approval:request:** Simulate agent sending `tool:approval:request` → verify message persisted with `approvalStatus = 'pending'`
- **Approve flow:** Create pending tool call → `POST /api/tools/:callId/approve` → verify approvalStatus updated to 'approved'
- **Reject flow:** Create pending tool call → `POST /api/tools/:callId/reject` → verify approvalStatus updated to 'rejected'
- **Respond flow:** Create pending ask_human → `POST /api/tools/:callId/respond` with text → verify approvalStatus updated
- **Invalid approve:** Approve a non-existent toolCallId → 404
- **Double approve:** Approve an already-approved tool call → appropriate error
- Existing tests still pass

## Verification

1. `pnpm build` succeeds
2. Start server + Postgres
3. All new tests pass
4. All existing tests pass
5. Can manually test via curl: create session, simulate tool:call, approve/reject

## On Completion

Update `docs/progress.md`. Commit with message: "Phase 9a — tool approval API and protocol"
