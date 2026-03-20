# Phase 11: UI Updates

Read `docs/coding-agent-plan.md` and `docs/progress.md` for full context.

## Task

Update the React UI to render tool calls, tool results, approval prompts, ask_human inputs, and context controls. Everything renders inline in the chat panel. No new panels or layouts.

## New Message Components (packages/ui/src/components/)

### ToolCallMessage
- Renders for `role: "tool_call"` messages
- Shows tool name as a label and arguments in a formatted block
- For `bash`: show the command in a terminal-style block
- For `read_file`: show the file path
- For `write_file`: show the file path and content (maybe truncated)
- For `context`: show the action and target message IDs
- For `ask_human`: show the question prominently

### ToolResultMessage
- Renders for `role: "tool_result"` messages
- For file contents: render in a code block with syntax highlighting if possible (or plain monospace)
- For bash output: render in a terminal-style block (dark background, monospace)
- For errors: render with an error styling
- For context status: render as a simple status summary

### ApprovalPrompt
- Shown when a tool_call message has `approvalStatus: "pending"`
- For `bash` and `write_file`: show "Approve" and "Reject" buttons
- On approve: `POST /api/tools/:callId/approve`
- On reject: `POST /api/tools/:callId/reject`
- After response: buttons disabled, show the outcome (approved/rejected)

### AskHumanPrompt
- Shown when `ask_human` tool call has `approvalStatus: "pending"`
- Show the question with a text input field and "Send" button
- On submit: `POST /api/tools/:callId/respond` with the response text
- After response: input disabled, show what was sent

## Context Gauge

Add a text display in the chat panel header or above the message list:
```
Context: 45k / 128k tokens (35%)
```

- Updated via `context:status` WebSocket messages
- Color or emphasis change when above 70% (e.g., bold or a warning color)

## Per-Message Context Controls

Each message gets a small control for context status:
- **Active messages:** Show a "drop" button/icon (e.g., an X or eye-slash)
- **Inactive messages:** Render grayed out / collapsed with a "restore" button
- **Summarized messages:** Show the summary text with an indicator like "(summary of 3 messages)" and a "restore" button

On drop: `PATCH /api/messages/:id/context-status` with `{ status: "inactive" }`
On restore: `PATCH /api/messages/:id/context-status` with `{ status: "active" }`

## WebSocket Handler Updates (packages/ui/src/hooks/useWebSocket.ts)

Handle new message types:
- `tool:approval:request` — add the tool call message to the session's message list with pending approval status
- `context:updated` — update the contextStatus of affected messages in state
- `context:status` — update the context gauge display

## Message List Updates

The existing message list component needs to:
- Render the new message roles using the appropriate component (ToolCallMessage, ToolResultMessage)
- Show ApprovalPrompt or AskHumanPrompt when a tool_call has pending approval
- Apply visual styling based on contextStatus (grayed out for inactive, summary indicator for summarized)
- Show tokenCount per message if available (subtle, e.g., small text)

## API Helpers (packages/ui/src/api.ts)

Add functions:
- `approveToolCall(callId: string)` → POST /api/tools/:callId/approve
- `rejectToolCall(callId: string)` → POST /api/tools/:callId/reject
- `respondToToolCall(callId: string, response: string)` → POST /api/tools/:callId/respond
- `setContextStatus(messageId: string, status: string)` → PATCH /api/messages/:id/context-status

## Verification

1. `pnpm build` succeeds
2. Start all three services in dev mode
3. Create a session, send a message that triggers tool use (e.g., "List the files in /workspace")
4. See the tool call rendered inline in the chat
5. See the approval prompt with buttons
6. Click "Approve" — tool executes, result appears inline
7. Click "Reject" on a subsequent tool call — agent adjusts
8. Send a message that triggers `ask_human` — see the question with text input
9. Respond — agent continues with the answer
10. Verify the context gauge shows and updates
11. Drop a message via its context control — verify it grays out
12. Restore it — verify it returns to normal

## On Completion

Update `docs/progress.md`. Commit with message: "Phase 11 — UI for tools, approval, and context management"
