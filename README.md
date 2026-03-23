# Simple-Coder

A sync-based headless coding agent with tools, human-in-the-loop approval, and context management.

## Quick Start

```bash
git clone <repo-url> && cd simple-coder
cp .env.example .env
# Edit .env — set LLM_API_KEY and optionally change AGENT_SECRET
docker compose up --build
```

Open **http://localhost:3000**. Type a message to create a session. The agent picks it up, uses tools to explore and modify code, and streams responses in real-time. Mutating actions (bash, write_file) require your approval before execution.

## Architecture

```
┌─────────┐  WS (/ws/ui)   ┌──────────────┐  WS (/ws/agent)   ┌───────────┐
│  React  │ ←────────────→ │    Hono      │ ←──────────────── │   Agent   │
│  (Vite) │   HTTP /api/*  │  Server      │   (outbound only) │  (Daemon) │
└─────────┘                └──────┬───────┘                   └───────────┘
                                  │                            no open ports
                                  ▼
                            ┌──────────┐
                            │ Postgres │
                            └──────────┘
```

## Summary

Simple-Coder is a coding agent built with Hono, Postgres, the Vercel AI SDK, and React.

The server acts as a stateless broker between an autonomous agent daemon and a browser UI, with all persistent state in Postgres. The agent connects outbound to the server — no exposed ports — and runs a tool loop in a workspace shared between sessions.

The agent has these tools:
1. `read_file` - Read files from the workspace
4. `write_file` - Write files to the workspace
3. `bash` - Run shell commands
2. `context` - Manage context window (drop/summarize/restore messages)
5. `ask_human` - Ask the user a question

My core idea for this project was transparent context management. I was inspired by my frustration with Cursor's inability to tell me about the state of its own context window.

In `simle-coder`, both the user and the agent have tools to manipulate the context directly. The agent can drop, summarize, or restore messages via a first-class `context` tool. The UI shows a live context gauge and lets the user do the same manually.

Other key decisions:
- Zero-tools baseline — Built full conversational infrastructure before adding any tools.
- Own agent loop — Wrote the tool orchestration loop instead of using the SDK's, so control flow is visible in the code.
- User-written summaries — Human can summarize context just like the agent.
- The server can restart without losing state, and agents reconnect automatically. `docker compose up --scale agent=3` works with zero code changes.

The project was built with Claude Code using phased prompts, with full planning docs and conversation records committed to the repo for transparency. Codex was used to review plans before execution.

---

## Details

**Three components, one port:**

- **Server** (Hono) — HTTP API, two WebSocket paths, static UI files. All persistent state in Postgres. In-memory connection registry makes the server a stateless broker. Manages tool approval flow and context state.
- **Agent** (Vercel AI SDK) — Connects outbound to the server, no exposed ports. Runs an autonomous tool loop: calls LLM, executes safe tools immediately, requests approval for mutating tools, repeats until no tool calls remain. Reconnects with exponential backoff.
- **UI** (React + Vite) — Real-time updates via WebSocket. Session list, chat panel, streaming messages, tool call rendering, approval buttons, and context management controls.

### WebSocket Protocol

Two paths with different trust models:

- `/ws/agent` — Bidirectional. Agent registers with a shared secret, receives session assignments, streams LLM tokens back, sends tool calls/results, receives approval responses, and sends transient warnings (e.g., rate limit notifications). Server validates authentication and rejects unauthorized connections.
- `/ws/ui` — Server→UI broadcast. Session updates, message events, streaming tokens, tool approval requests, context status updates, and agent warnings. No authentication (single-user localhost deployment).

All messages are JSON with a discriminated `type` field. Types are defined in `packages/shared/src/ws-messages.ts`.

### Session Lifecycle

1. User sends a message → `POST /api/sessions` → session created as **pending**
2. Server finds an idle agent → dispatches via `session:assign` → state becomes **active**
3. Agent runs tool loop: calls LLM, executes tools, streams thinking + response tokens
4. When the LLM produces no tool calls, the agent sends `turn:complete` and releases the session
5. User sends follow-up → session re-dispatched to an idle agent with full message history
6. User stops session → server sends `session:stop` to agent → state becomes **stopped**
7. If agent disconnects → active session returns to **pending** (re-dispatchable to next agent)

### Tools and Approval

The agent has five tools, classified by safety:

| Tool | Purpose | Approval |
|------|---------|----------|
| `read_file` | Read files from the workspace | No |
| `context` | Manage context window (drop/summarize/restore messages) | No |
| `bash` | Run shell commands | **Yes** |
| `write_file` | Write files to the workspace | **Yes** |
| `ask_human` | Ask the user a question | Blocks for text response |

Safe tools (`read_file`, `context`) execute immediately. Consequential tools (`bash`, `write_file`) pause for user approval via the UI. `ask_human` blocks until the user provides a text response.

### Error Handling

The agent handles LLM API errors gracefully. Rate limit errors (HTTP 429) are detected automatically: the agent extracts the reset timestamp from the API response headers, sends a transient `agent:warning` to the UI (not persisted to the database), and retries after the rate limit window resets. The UI displays warnings inline in the chat timeline with a live countdown timer.

### Context Management

The agent manages its context window proactively:

- **Drop** messages to remove them from the active context (recoverable)
- **Summarize** a group of messages into a shorter summary
- **Activate** dropped or summarized messages back to active
- A context gauge shows current token usage vs. the configured maximum

### Project Structure

```
packages/
├── shared/    — TypeScript types, constants, WebSocket message definitions
├── server/    — Hono API + WebSocket + Postgres
├── agent/     — Headless agent daemon (Vercel AI SDK)
└── ui/        — React + Vite frontend
```

### Development

```bash
pnpm install
pnpm build

# Run each in a separate terminal (requires Postgres on localhost:5432):
pnpm dev:server    # Hono server on :3000
pnpm dev:agent     # Agent daemon
pnpm dev:ui        # Vite dev server on :5173

# Tests (requires Postgres with simple_coder_test database):
pnpm test
```

### Design Decisions

Detailed rationale is in [`docs/decisions/`](docs/decisions/). Key choices:

**Infrastructure first, then tools.** Phases 0–7 built a zero-tool conversational agent to prove streaming, sync, persistence, and real-time UI work. Phases 8–12 added the tool system, approval flow, and context management on top of proven infrastructure.

**Three-way safety classification.** Tool calls are classified as `execute` (safe — run immediately), `approve` (consequential — wait for user approval), or `ask_human` (block for text response). This is an extensible seam: the classifier can be swapped without changing the tool loop. See ADR-010.

**Flat message model for tool calls.** Tool calls and results are stored as regular messages with additional columns (`toolName`, `toolArgs`, `toolCallId`, `approvalStatus`), not in a separate table. This keeps the message timeline linear and simplifies the UI. See ADR-013.

**Context management as a first-class tool.** The agent can manage its own context window via the `context` tool — dropping, summarizing, and activating messages. Summaries replace groups of messages with a shorter text, enforced by database constraints (no overlapping summaries, only active messages can be summarized). See ADR-012.

**Server as stateless broker.** The server holds connections in memory but all persistent state lives in Postgres. A server restart means agents reconnect and sessions resume from the database. This also enables `docker compose up --scale agent=3` with zero code changes.

**Turn-based agent lifecycle.** After each tool loop completes, the agent sends `turn:complete` and releases the session. Follow-up messages re-dispatch the session with full history. This keeps agents available for other work between turns. See ADR-019.

Full design rationale is in [`docs/decisions/`](docs/decisions/) and [`docs/coding-agent-plan.md`](docs/coding-agent-plan.md).

### Testing

63 integration tests across 7 test files:

- **Sessions** — CRUD operations, error handling
- **Agent WebSocket** — Authentication, dispatch, disconnect recovery
- **Session Lifecycle** — Full create→dispatch→respond→stop flow, turn:complete agent release, follow-up re-dispatch, multi-session sequential handling, agent failover
- **Tool Messages** — Tool call/result persistence, WebSocket broadcast flow
- **Tool Approval** — Approve/reject/respond endpoints, error cases, UI broadcast
- **Context Management** — Token estimation, status updates, summary CRUD, constraint enforcement
- **Context API** — REST endpoints for drop/restore, summarize, context status

Tests use real Postgres (via Docker) and simulate the agent WebSocket protocol directly — no LLM mocking needed.

```bash
docker compose up -d postgres
docker compose exec postgres psql -U simple_coder -c "CREATE DATABASE simple_coder_test;"
pnpm test
```

### AI Coding Agent Usage

This project was built entirely with [Claude Code](https://claude.com/claude-code) (Claude Opus). The methodology:

1. **Planning session** — architectural decisions made conversationally, documented via the `/conversation-notes` skill
2. **Phased prompts** — each implementation phase has a self-contained prompt in [`docs/prompts/`](docs/prompts/) with clear inputs, outputs, and verification steps
3. **Incremental commits** — each phase produces one or more commits with meaningful messages

The `.claude/` directory, `CLAUDE.md`, planning docs, and conversation records are all committed to show the full AI-assisted development process.

### Demo

_Loom video to be added._
