# Coding Agent Implementation Plan

## Context

Phases 0–7 built the infrastructure: conversational multi-turn agent with thinking tokens, Hono server, Postgres, React UI, Docker Compose, and integration tests. This plan covers evolving the system into a coding agent with tools, an approval flow, and context management.

Design decisions are documented in ADR-010 through ADR-017 ([decisions index](decisions/README.md)). The brainstorming conversation is in [Conversation 002](conversations/002-coding-agent-design.md).

## Overview

Five tools, own agent loop, flat message model, approval gates, context management.

| Tool | Execution | Approval Required |
|------|-----------|-------------------|
| `bash` | Local in agent container | Yes |
| `read_file` | Local in agent container | No |
| `write_file` | Local in agent container | Yes |
| `context` | HTTP to server API | No |
| `ask_human` | WebSocket wait for response | Yes (blocks for response) |

## Schema Changes

### Messages table — new columns

```sql
ALTER TABLE messages
  ADD COLUMN tool_name    TEXT,
  ADD COLUMN tool_args    JSONB,
  ADD COLUMN tool_call_id TEXT,
  ADD COLUMN context_status TEXT NOT NULL DEFAULT 'active'
    CHECK (context_status IN ('active', 'summarized', 'inactive')),
  ADD COLUMN approval_status TEXT
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN token_count  INTEGER;

-- Expand role constraint
ALTER TABLE messages DROP CONSTRAINT messages_role_check;
ALTER TABLE messages ADD CONSTRAINT messages_role_check
  CHECK (role IN ('user', 'assistant', 'system', 'tool_call', 'tool_result'));
```

### New tables

```sql
CREATE TABLE IF NOT EXISTS summaries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  token_count INTEGER,
  created_by  TEXT NOT NULL CHECK (created_by IN ('agent', 'user')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS summary_messages (
  summary_id UUID NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  PRIMARY KEY (summary_id, message_id),
  UNIQUE (message_id)  -- Rule 1: a message can only belong to one summary
);
```

### Constraints enforcing summary rules

- **Rule 1 (no overlapping):** `UNIQUE (message_id)` on `summary_messages`
- **Rule 2 (only active messages):** Enforced at the API level — the summarize endpoint checks that all target messages have `context_status = 'active'` before creating a summary

## New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/tools/:callId/approve | Approve a pending tool call |
| POST | /api/tools/:callId/reject | Reject a pending tool call |
| POST | /api/tools/:callId/respond | Respond to ask_human (body: { response }) |
| POST | /api/sessions/:id/summaries | Create a summary (body: { content, messageIds, createdBy }) |
| PATCH | /api/messages/:id/context-status | Set context_status (body: { status }) |
| GET | /api/sessions/:id/context | Get context status (token counts, message states) |

## New WebSocket Message Types

**Agent → Server:**
- `tool:approval:request` — tool call needing human approval (toolName, args, toolCallId)

**Server → Agent:**
- `tool:approval:response` — approved/rejected (toolCallId, approved, response text for ask_human)
- `context:updated` — user changed context status from UI

**Server → UI:**
- `tool:approval:request` — relay for UI rendering
- `context:updated` — message status changed
- `context:status` — token counts for context gauge

## Agent Loop

Replaces the current single-call `runLlmTurn`:

```
while true:
  assemble active messages (filter by contextStatus)
  build dynamic system prompt (role + state + budget + reminders)
  call LLM via Vercel AI SDK streamText with tool definitions
  stream thinking + text tokens to server
  if no tool calls → add assistant message, done
  for each tool call:
    check safety (assessToolCall)
    if safe → execute locally, add tool_call + tool_result messages
    if needs approval → send tool:approval:request, wait for response
      if approved → execute, add messages
      if rejected → add rejection as tool_result, continue loop
  continue loop
```

## Dynamic System Prompt

Assembled per-call:

```
[Role and behavioral guidance]
You are a coding agent working in a sandboxed container. You have
access to tools for reading/writing files, running shell commands,
managing your context window, and asking the user questions.
[... guidance on when to ask vs act, how to manage context ...]

[Dynamic state]
Working directory: /workspace
Cloned repos: [list or "none yet"]
Context: ~45,000 / 128,000 tokens (35%)

[Behavioral reinforcement]
Reminders:
- Use ask_human when uncertain — don't guess
- Mutating actions (write_file, bash) require approval
- When context exceeds 70%, summarize or drop old messages
- Keep the user informed of what you're doing and why
```

## Tool Definitions

### bash
- **Args:** `{ command: string }`
- **Execution:** `child_process.exec` in agent container
- **Returns:** `{ stdout, stderr, exitCode }`
- **Approval:** Always required

### read_file
- **Args:** `{ path: string }`
- **Execution:** `fs.readFile` in agent container
- **Returns:** `{ content: string }` or `{ error: string }`
- **Approval:** Never

### write_file
- **Args:** `{ path: string, content: string }`
- **Execution:** `fs.writeFile` in agent container
- **Returns:** `{ success: boolean }` or `{ error: string }`
- **Approval:** Always required

### context
- **Args:** `{ action: "status" | "drop" | "summarize" | "activate", messageIds?: string[], summary?: string }`
- **Execution:** HTTP calls to server API
- **Returns:** For status: message list with token counts. For others: success/error.
- **Approval:** Never

### ask_human
- **Args:** `{ question: string }`
- **Execution:** Sends tool:approval:request to server, waits for response
- **Returns:** `{ response: string }` — the human's answer
- **Approval:** Blocks for response (not approve/reject, but text input)

## Safety Check

```typescript
type ToolAction = "execute" | "approve" | "ask_human";

function assessToolCall(tool: string, args: unknown): { action: ToolAction } {
  if (tool === "ask_human") return { action: "ask_human" };
  const safeTools = ["read_file", "context"];
  return { action: safeTools.includes(tool) ? "execute" : "approve" };
}
```

Three-way classification: `execute` (safe tools — run immediately), `approve` (consequential tools — wait for user approval), `ask_human` (blocks for user text response). Extensible seam for future classification logic.

## UI Changes

- **Inline tool rendering:** Tool calls show as cards (tool name + args). Tool results show as code blocks or terminal output.
- **Approval UI:** Approve/reject buttons for bash and write_file. Text input for ask_human.
- **Context gauge:** Text display in header — "Context: 45k / 128k (35%)"
- **Per-message controls:** Drop/restore toggle on each message. Dropped messages shown grayed out.
- **Summarized messages:** Show summary text with indicator of how many messages it replaces.

## Conventions

**UUID generation:** The agent generates message UUIDs locally via `crypto.randomUUID()`. This avoids round-trips to the server when the agent needs a toolCallId to link tool_call and tool_result messages within the same turn. The server accepts agent-provided IDs.

**Max tokens:** Configured via `LLM_MAX_TOKENS` env var (default: 128000). Used for the context gauge and system prompt budget. Not a hard limit — just informational for the agent and UI.

**Session response includes summaries:** The existing `GET /api/sessions/:id` endpoint returns messages and summaries together, so the UI can render summarized messages without a separate fetch.

## Docker Changes

- Agent Dockerfile: add `git`, `build-essential`, `curl`, `nodejs`
- docker-compose.yml: pass `GITHUB_TOKEN` and `LLM_MAX_TOKENS` to agent container
- .env.example: document optional `GITHUB_TOKEN` and `LLM_MAX_TOKENS`

## Build Sequence

### Phase 8: Schema + Type Updates
- Expand Message type, add new roles and fields
- Add summaries/summary_messages tables
- Update ws-messages.ts with new message types
- Update constants with new roles and statuses

### Phase 9: Server API + Protocol
- New REST endpoints for approval and context management
- Server-side WebSocket handling for new message types
- Context status broadcasting
- Token count estimation utility

### Phase 10: Agent Tool Loop
- Own agent loop replacing single LLM call
- Tool definitions and executor
- Safety check function
- Dynamic system prompt builder
- Message format translation (our format ↔ Vercel AI SDK)

### Phase 11: UI Updates
- Tool call/result message rendering
- Approval flow UI
- ask_human UI
- Context gauge
- Per-message drop/restore controls

### Phase 12: Docker + Integration
- Update agent Dockerfile with dev tools
- Update docker-compose.yml with new env vars
- End-to-end testing in containers

### Phase 13: Testing + Polish
- Integration tests for tool execution, approval, context management
- Error handling for tool failures
- README updates
