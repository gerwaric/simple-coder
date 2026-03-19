# Pre-Tools Audit

Audit of simple-coder against `docs/project-definition.md`, performed 2026-03-18. All findings verified in code, not documentation.

## 1. Server Process

| Requirement | Status | Evidence |
|---|---|---|
| Runs on a web server | PASS | Hono on Node.js, port 3000 |
| Manages a database | PASS | Postgres 16 via `postgres.js`, schema auto-created |
| API for user interaction | PASS | REST: `POST/GET /api/sessions`, `POST .../messages`, `POST .../stop` |
| Sync-driven functionality for UI | PASS | WebSocket `/ws/ui` broadcasts all events in real-time |

## 2. Headless Coding Agent / Daemon

| Requirement | Status | Evidence |
|---|---|---|
| Can run anywhere with outbound connectivity | PASS | Reads `SERVER_WS_URL` env var, connects outbound |
| Contains agent loop with inference | PARTIAL | Has LLM inference loop with streaming, but no tools — agent is chat-only. Protocol defines `tool:call`/`tool:result` types but nothing implements them. |
| Startable with a simple CLI command | PASS | `node dist/index.js` or `pnpm dev:agent` |
| Connects outbound to server | PASS | `new WebSocket(this.serverUrl)` in `connection.ts` |
| Server cannot initiate connections | PASS | Agent container exposes no ports; server has no outbound connection code |
| Streams events in real-time | PARTIAL | Streams thinking tokens and assistant tokens. Tool calls defined but never emitted (no tools exist). |

## 3. User Interface

| Requirement | Status | Evidence |
|---|---|---|
| Reactive UI | PASS | React 19 + Vite 6, WebSocket for real-time updates |
| Interact with server over APIs | PASS | REST for actions, WebSocket for streaming |
| Running sessions synced in real-time | PASS | Token-level streaming with cursor animation |
| Create a session | PASS | "New Session" button, `POST /api/sessions` |
| Stop a session | PASS | "Stop" button on active sessions, `POST .../stop` |

## 4. Constraints

| Requirement | Status | Evidence |
|---|---|---|
| Entirely TypeScript | PASS | All 36 source files are `.ts`/`.tsx` |
| No banned SDKs (Claude Code, OpenCode, Amp, Cursor) | PASS | Only Vercel AI SDK, Hono, React, postgres.js |
| No paid services beyond LLM API key | PASS | Postgres is self-hosted via Docker |
| No Next.js | PASS | Vite + React only |
| Docker Compose config included | PASS | `docker-compose.yml` at root |
| LLM API key configurable | PASS | `LLM_API_KEY` in `.env`, supports Anthropic + OpenAI |
| All work tracked in version control | PASS | Clean git history with phased commits |

## 5. Docker Compose

| Requirement | Status | Evidence |
|---|---|---|
| Container for server/UI | PASS | `server` service, `Dockerfile.server` bundles UI into server |
| Container for database | PASS | `postgres` service, postgres:16-alpine |
| Separate container for agent (e.g. ubuntu) | PASS | `agent` service, ubuntu:24.04 base |
| Server/UI exposes ports | PASS | Port 3000 |
| Agent exposes NO ports | PASS | No `ports:` or `EXPOSE` in agent service/Dockerfile |
| `.env` + `docker compose up` with no extra steps | PASS | Verified: both images build clean |
| Builds successfully | PASS | Confirmed via `docker compose build` |

## 6. Deliverables

| Requirement | Status | Evidence |
|---|---|---|
| Full source code with git history | PASS | Phased commits visible |
| README with architecture overview | PASS | Clear architecture diagram, design decisions, stack description |
| README with setup instructions | PASS | Quick start section with 3 commands |
| README section on AI agent usage | PASS | "AI Coding Agent Usage" section describes Claude Code + methodology |
| README links to demo video | MISSING | `_Loom video to be added._` — placeholder only |
| `.claude/` config directory committed | PASS | `.claude/commands/` with 2 skill files committed |

## Key Findings

### Critical gap

- **No demo video** — the project definition says "The README should contain a link to a Loom video." Currently a placeholder.

### Notable gap

- **No tools in the agent** — the agent only does conversational chat. The spec says the daemon "contains the coding agent's agent loop" and the project is described as a "coding agent." While the zero-tools approach is a deliberate design decision (documented in ADR-002), the agent cannot actually write or read code. The protocol infrastructure is there, but nothing is wired. Whether this matters depends on how strictly "coding agent" is interpreted — the project definition does say it won't be evaluated on feature completeness.

### Minor observations

- Postgres port 5432 is exposed to the host — not required, could be internal-only.
- The agent Dockerfile is not multi-stage, so it ships build tools in the final image.
- `.env` is properly gitignored.
- `CLAUDE.md` is committed per requirements.
