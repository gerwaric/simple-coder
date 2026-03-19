# Simple-Coder

A sync-based headless coding agent system with a Hono server, agent daemon, and React UI. Built as a HumanLayer take-home assessment.

## Quick Start

```bash
git clone <repo-url> && cd simple-coder
cp .env.example .env
# Edit .env — set LLM_API_KEY and optionally change AGENT_SECRET
docker compose up --build
```

Open **http://localhost:3000**. Type a message to create a session. The agent picks it up and streams a response in real-time, with thinking tokens shown in a collapsible section.

## Architecture

```
┌─────────┐  WS (/ws/ui)  ┌──────────────┐  WS (/ws/agent)  ┌───────────┐
│  React  │ ←────────────→ │    Hono      │ ←──────────────── │   Agent   │
│  (Vite) │   HTTP /api/*  │  Server      │   (outbound only) │  (Daemon) │
└─────────┘                └──────┬───────┘                   └───────────┘
                                  │                            no open ports
                                  ▼
                            ┌──────────┐
                            │ Postgres │
                            └──────────┘
```

**Three components, one port:**

- **Server** (Hono) — HTTP API, two WebSocket paths, static UI files. All persistent state in Postgres. In-memory connection registry makes the server a stateless broker.
- **Agent** (Vercel AI SDK) — Connects outbound to the server, no exposed ports. Streams thinking tokens and response tokens separately. Reconnects with exponential backoff.
- **UI** (React + Vite) — Real-time updates via WebSocket. Session list, chat panel, streaming message display with collapsible thinking.

### WebSocket Protocol

Two paths with different trust models:

- `/ws/agent` — Bidirectional. Agent registers with a shared secret, receives session assignments, streams LLM tokens back. Server validates authentication and rejects unauthorized connections.
- `/ws/ui` — Server→UI broadcast. Session updates, message events, streaming tokens. No authentication (single-user localhost deployment).

All messages are JSON with a discriminated `type` field. Types are defined in `packages/shared/src/ws-messages.ts`.

### Session Lifecycle

1. User sends a message → `POST /api/sessions` → session created as **pending**
2. Server finds an idle agent → dispatches via `session:assign` → state becomes **active**
3. Agent runs LLM, streams thinking + response tokens → server persists and relays to UI
4. User sends follow-up → server relays to agent → agent responds
5. User stops session → server sends `session:stop` to agent → state becomes **stopped**
6. If agent disconnects → active session returns to **pending** (re-dispatchable to next agent)

## Project Structure

```
packages/
├── shared/    — TypeScript types, constants, WebSocket message definitions
├── server/    — Hono API + WebSocket + Postgres
├── agent/     — Headless agent daemon (Vercel AI SDK)
└── ui/        — React + Vite frontend
```

## Development

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

## Design Decisions

Detailed rationale is in [`docs/decisions/`](docs/decisions/). Key choices:

**Zero tools first.** The agent starts as a conversational LLM with no tool access. This proves the infrastructure — streaming, sync, persistence, real-time UI — works correctly before adding tool complexity. Tools are pluggable: the protocol already defines `tool:call` and `tool:result` message types.

**Thinking tokens in the protocol.** Reasoning tokens are streamed separately from response tokens and displayed in a collapsible UI section. This gives visibility into the LLM's reasoning process and creates a natural place for human oversight.

**Server as stateless broker.** The server holds connections in memory but all persistent state lives in Postgres. A server restart means agents reconnect and sessions resume from the database. This also enables `docker compose up --scale agent=3` with zero code changes.

**Agent authentication via shared secret.** The agent sends `AGENT_SECRET` during WebSocket registration. The server rejects connections with invalid secrets. UI auth is skipped — this is a single-user localhost deployment.

**Extensibility path.** The architecture naturally supports:
- **Tool calls** — defined in the protocol, not yet wired. Adding tools means implementing a tool executor in the agent and rendering tool events in the UI.
- **Human-in-the-loop approval** — the server-as-broker model supports holding tool calls pending until a human approves them via the UI.
- **Multiple agents** — the dispatch model supports N agents. `--scale agent=3` works today.
- **Sub-agents** — the `LlmClient` is stateless and reusable. Sub-agents are just additional instances with different system prompts.

## Testing

12 integration tests covering the full session lifecycle:

- Session CRUD via HTTP API
- Agent authentication (valid + invalid secret)
- Session dispatch to idle agents
- Message persistence and token streaming to UI
- Session stop and agent disconnect recovery

Tests use real Postgres (via Docker) and simulate the agent protocol directly — no LLM mocking needed.

## AI Coding Agent Usage

This project was built entirely with [Claude Code](https://claude.com/claude-code) (Claude Opus). The methodology:

1. **Planning session** — architectural decisions made conversationally, documented via the `/conversation-notes` skill
2. **Phased prompts** — each implementation phase has a self-contained prompt in [`docs/prompts/`](docs/prompts/) with clear inputs, outputs, and verification steps
3. **Incremental commits** — each phase produces one or more commits with meaningful messages

The `.claude/` directory, `CLAUDE.md`, planning docs, and conversation records are all committed to show the full AI-assisted development process.

## Demo

_Loom video to be added._
