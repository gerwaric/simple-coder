# Simple-Coder Implementation Plan

## Context

This is a take-home assessment for HumanLayer: build a sync-based headless coding agent system with server, agent daemon, and UI. The assessment evaluates design thinking and architecture, not feature count. We're starting with a zero-tool conversational agent to get the infrastructure solid first, with plans to experiment with unconventional tool architectures later (e.g., an `ask()` meta-tool).

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

- **Single port** serves HTTP API + WebSocket + static UI files
- **Two WebSocket paths**: `/ws/agent` (agent↔server) and `/ws/ui` (server→UI)
- **Server is the broker**: dispatches sessions to idle agents, relays events to UI
- **Agent connects outbound**: no exposed ports, reconnects with backoff

## Stack

| Component | Technology |
|-----------|-----------|
| Monorepo | pnpm workspaces |
| Shared types | TypeScript, tsup |
| Server | Hono, @hono/node-server, @hono/node-ws, postgres (porsager) |
| Agent | Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`), `ws` |
| UI | React, Vite |
| Database | Postgres 16 |
| Containers | Docker Compose |

## Project Structure

```
simple-coder/
├── package.json              # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── CLAUDE.md                 # Project conventions for Claude Code sessions
├── docker-compose.yml
├── docker/
│   ├── Dockerfile.server
│   └── Dockerfile.agent
├── .claude/
│   └── commands/
│       └── conversation-notes.md  # /conversation-notes skill
├── docs/
│   ├── project-definition.md      # The HumanLayer spec (already exists)
│   ├── implementation-plan.md     # This plan (copied from .claude/plans/)
│   ├── decisions/
│   │   ├── README.md              # ADR index
│   │   └── NNN-*.md               # Individual ADRs
│   └── conversations/
│       ├── README.md              # Conversation index
│       └── NNN-*.md               # Conversation summaries
├── packages/
│   ├── shared/src/
│   │   ├── types.ts          # Session, Message interfaces
│   │   ├── ws-messages.ts    # Discriminated union for all WS messages
│   │   └── constants.ts      # SessionState, MessageRole enums
│   ├── server/src/
│   │   ├── index.ts          # Entry: Hono app + serve
│   │   ├── db/schema.sql     # Two tables: sessions, messages
│   │   ├── db/index.ts       # Postgres connection
│   │   ├── db/queries.ts     # Pure query functions
│   │   ├── routes/sessions.ts # REST API endpoints
│   │   ├── ws/agent-ws.ts    # Agent WS handler + dispatch
│   │   ├── ws/ui-ws.ts       # UI WS handler + broadcast
│   │   └── ws/connections.ts # In-memory connection registry
│   ├── agent/src/
│   │   ├── index.ts          # CLI entry point
│   │   ├── connection.ts     # WS client, message routing, reconnect
│   │   └── llm.ts            # Vercel AI SDK wrapper, stateless + reusable for sub-agents
│   └── ui/src/
│       ├── main.tsx
│       ├── App.tsx            # Layout: sidebar + chat panel
│       ├── api.ts             # HTTP helpers
│       ├── hooks/useWebSocket.ts
│       ├── hooks/useSessions.ts
│       └── components/        # SessionList, ChatPanel, MessageBubble, StreamingMessage
```

~40 files total.

## Database Schema

```sql
CREATE TABLE sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state      TEXT NOT NULL DEFAULT 'pending'
               CHECK (state IN ('pending', 'active', 'completed', 'stopped')),
  agent_id   TEXT,
  title      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content    TEXT NOT NULL,
  thinking   TEXT,            -- LLM reasoning/thinking tokens (nullable, provider-dependent)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

No migration framework — single schema.sql run on startup if tables don't exist.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/sessions | Create session + first user message → pending |
| GET | /api/sessions | List all sessions |
| GET | /api/sessions/:id | Get session + messages |
| POST | /api/sessions/:id/messages | Send user message to active session |
| POST | /api/sessions/:id/stop | Stop session, notify agent |

## WebSocket Protocol

Discriminated union on `type` field, JSON messages.

**Agent ↔ Server** (`/ws/agent`):
- `agent:register` — agent identifies itself + sends shared secret (`AGENT_SECRET`); server rejects and closes connection if invalid
- `agent:ready` — agent signals idle, ready for work
- `session:assign` — server sends session + message history to agent
- `user:message` — server relays new user message to agent
- `thinking:token` — agent streams a reasoning/thinking chunk
- `thinking:complete` — agent finished thinking (full thinking text)
- `assistant:token` — agent streams a response text chunk
- `assistant:message:complete` — agent finished a response (full message including thinking)
- `tool:call` — *(placeholder, not implemented yet)* agent invokes a tool
- `tool:result` — *(placeholder, not implemented yet)* tool execution result
- `session:stop` — server tells agent to abort
- `session:completed` — agent signals session done

**Server → UI** (`/ws/ui`):
- `session:updated` — session state changed
- `message:created` — new message persisted
- `thinking:stream` — streaming thinking token for display
- `token:stream` — streaming response token for display
- `message:complete` — final assistant message (includes thinking if present)
- `tool:call` — *(placeholder)* agent tool invocation for display
- `tool:result` — *(placeholder)* tool result for display

The protocol is designed to accommodate the full event model described in the spec
(tool calls, thinking tokens, assistant messages) even though only thinking + assistant
messages are implemented initially. Placeholder types are defined in `ws-messages.ts`
but nothing sends them yet.

## Session Lifecycle

1. User creates session via UI → `POST /api/sessions` → state=**pending**
2. Server checks for idle agent → dispatches via `session:assign` → state=**active**
3. Agent runs LLM, streams tokens → server persists + relays to UI
4. User sends follow-up → server relays to agent → agent responds
5. User stops session → `POST /api/sessions/:id/stop` → server sends `session:stop` to agent → state=**stopped**
6. If agent disconnects: active session → **pending** (re-dispatchable)

One session at a time per agent. Server manages the queue.

## Build Sequence (each phase is independently testable)

### Phase 0: Scaffolding
- Root config (package.json, pnpm-workspace.yaml, tsconfig.base.json, .gitignore)
- Package scaffolds with package.json and tsconfig.json
- CLAUDE.md with project conventions
- `.claude/commands/conversation-notes.md` skill (see Documentation Workflow below)
- `docs/` structure: decisions/ and conversations/ with README indexes
- **Verify**: `pnpm install && pnpm build` succeeds

### Phase 1: Shared Types + Database
- shared/src/types.ts, ws-messages.ts, constants.ts
- server/src/db/ (schema.sql, connection, queries)
- **Verify**: Postgres starts, schema applies, insert/read works

### Phase 2: Server HTTP + WebSocket
- Hono app with session REST routes
- WebSocket handlers for /ws/agent and /ws/ui
- Connection registry and dispatch logic
- **Verify**: curl creates sessions, wscat connects to WS endpoints

### Phase 3: Agent Daemon
- CLI entry point, WS connection with reconnect
- LLM client via Vercel AI SDK (supports Anthropic, OpenAI, llama.cpp)
- Session handling: receive assignment, stream LLM response, handle follow-ups
- Stream both reasoning (thinking tokens) and response tokens separately
- **Verify**: Agent connects, receives session, streams thinking + response back to server

### Phase 4: React UI
- Session list + chat panel layout
- WebSocket hook for real-time updates
- HTTP API calls for session management
- Streaming message display with thinking tokens (collapsible, visually distinct)
- **Verify**: Full end-to-end in dev mode (3 terminals)

### Phase 5: Docker Compose
- Dockerfile.server (multi-stage: build shared+server+ui, serve from single container)
- Dockerfile.agent (ubuntu-based, no exposed ports)
- docker-compose.yml with postgres, server, agent
- **Verify**: `cp .env.example .env && docker compose up --build` works end-to-end

### Phase 6: Testing
- Deterministic integration tests validating the session lifecycle:
  - Create session → verify state is pending
  - Agent connects + registers with valid secret → verify accepted
  - Agent connects with invalid secret → verify rejected
  - Session dispatched to idle agent → verify state is active
  - Agent sends message complete → verify message persisted
  - Stop session → verify state is stopped
  - Agent disconnects → verify active session returns to pending
- Tests use real Postgres (docker) but mock the LLM (deterministic responses)
- Test runner: vitest

### Phase 7: Polish
- Error handling: reconnection, graceful shutdown, input validation
- Agent disconnect → session back to pending
- README with architecture, setup instructions, design decisions, AI usage section

## Key Design Decisions

1. **Single port for everything** — HTTP + WS + static files on one Hono server. Simplifies Docker and CORS.
2. **Two WS paths, not one multiplexed** — different trust models, self-documenting protocol.
3. **Server as stateless broker** — in-memory connections, all persistent state in Postgres. Server restart = agents reconnect, sessions resume from DB.
4. **No ORM** — two tables, raw SQL via `postgres` package. Readable, fast, no abstraction overhead.
5. **Zero tools first** — proves the infrastructure (streaming, sync, persistence) works. Tools are pluggable later.
6. **Ubuntu agent container** — matches spec requirement, realistic sandbox environment.
7. **Agent shared secret** — `AGENT_SECRET` env var. Agent sends it during `agent:register`; server rejects unauthorized connections. This is the real trust boundary. UI auth is skipped (single-user localhost deployment).
8. **Minimal system prompt** — "You are a helpful coding assistant." Kept deliberately simple as a starting point.

## Commit Strategy

Small, intentional commits that tell a story in the git history:

1. **"Project inception — plan and documentation structure"** — plan, docs scaffolding, CLAUDE.md, /conversation-notes skill
2. **"Document initial planning session"** — run /conversation-notes for this session → conversation record + ADRs
3. **"Phase 0 — project scaffolding"** — root configs, package scaffolds, .env.example
4. **One or more commits per phase thereafter** — each phase gets at least one commit with a meaningful message

## Verification (end-to-end)

1. `docker compose up --build` with a valid `.env`
2. Open `http://localhost:3000`
3. Create a session with a message
4. See agent pick it up, stream thinking tokens then response in real-time
5. Expand/collapse thinking section in UI
6. Send follow-up message, get response
7. Stop session
8. Create another session, verify it works

## Agent Design Notes

The `LlmClient` in `packages/agent/src/llm.ts` is intentionally **stateless and reusable**.
It takes messages in, streams a response out, and holds no conversation state. This means:
- Sub-agents are just additional `LlmClient` instances with different system prompts
- The parent agent's tool executor can call a sub-agent, collect its result, and decide what to stream back
- No architectural changes needed to support the `ask()` meta-tool pattern or any other sub-agent dispatch model

## Documentation Workflow

### Structure
```
docs/
├── decisions/          # ADRs — one per settled decision
│   └── README.md       # Index of all ADRs
└── conversations/      # Narrative summaries of planning sessions
    └── README.md       # Index of all conversations
```

### The `/conversation-notes` skill
A single command that generates both artifacts from the current conversation:

1. Creates `docs/conversations/NNN-<slug>.md` — near-verbatim record capturing:
   - The actual back-and-forth dialogue, lightly structured with topic headers
   - Questions as asked, answers as given — not compressed into bullet points
   - Dead ends, reversals, and "wait, what about..." moments preserved
   - Minimal editorial intervention — the ADRs do the summarizing, not the conversation note

2. For each decision settled in the conversation, creates `docs/decisions/NNN-<title>.md`:
   - Standard ADR format: Context, Decision, Consequences
   - Links back to the source conversation
   - Status field: Accepted / Superseded / Amended

3. Updates both README indexes

### Cross-linking
- Each conversation note lists the ADRs it produced
- Each ADR links back to the conversation that produced it
- Bidirectional traceability with a single command

### ADR Template
```markdown
# <Title>
**Status:** Accepted
**Date:** YYYY-MM-DD
**Source:** [Conversation NNN](../conversations/NNN-slug.md)

## Context
What prompted this decision.

## Decision
What we decided.

## Consequences
What follows — both good and trade-offs.
```

### Conversation Note Template
```markdown
# <Session Title>
**Date:** YYYY-MM-DD

## Decisions Made
- [ADR-NNN: Title](../decisions/NNN-title.md)

## Discussion

### <Topic>

**Tom:** <question or statement, close to verbatim>

**Claude:** <response, close to verbatim — preserve reasoning, not just conclusions>

**Tom:** <follow-up>

**Claude:** <response>

### <Next Topic>
...
```

The goal is a lightly structured transcript, not a summary. Preserve the
texture of how ideas developed — the ADRs extract the decisions.

## Coding Agent — Phase 2

Phases 8–13 evolve the system from a conversational agent into a coding agent with tools, approval flow, and context management. See [`docs/coding-agent-plan.md`](coding-agent-plan.md) for the full plan, and ADR-010 through ADR-017 for design decisions.

## Extensibility Notes (for README)

The protocol and database are designed to support the full event model from day one:
- **Tool calls**: `tool:call` and `tool:result` message types are defined but not yet wired.
  Adding tools means implementing a tool executor in the agent and rendering tool events in the UI.
- **Human-in-the-loop approval**: The server-as-broker architecture naturally supports a
  pattern where tool calls are held pending until a human approves them via the UI — the
  server simply delays relaying the approval to the agent.
- **Multiple agents**: The dispatch model supports N agents connecting to one server.
  `docker compose up --scale agent=3` would work with zero code changes.
