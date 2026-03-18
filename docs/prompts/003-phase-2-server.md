# Phase 2: Server HTTP + WebSocket

Read `docs/implementation-plan.md` and `docs/progress.md` for full context.

## Task

Implement the Hono server with REST API endpoints, WebSocket handlers for both agent and UI channels, connection registry, and session dispatch logic.

## HTTP Routes (packages/server/src/routes/sessions.ts)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/sessions | Create session + first user message → state=pending, attempt dispatch |
| GET | /api/sessions | List all sessions |
| GET | /api/sessions/:id | Get session + messages |
| POST | /api/sessions/:id/messages | Send user message to active session, relay to agent |
| POST | /api/sessions/:id/stop | Stop session, notify agent |

## WebSocket: Agent Channel (packages/server/src/ws/agent-ws.ts)

Handle `/ws/agent`:
- On `agent:register`: validate AGENT_SECRET, store connection in registry, reject if invalid
- On `agent:ready`: check for pending sessions, dispatch if available
- On `assistant:token`: relay to UI clients watching that session
- On `thinking:token`: relay to UI clients
- On `thinking:complete`: relay to UI clients
- On `assistant:message:complete`: persist message to DB, relay to UI, keep agent assigned to session (multi-turn)
- On `session:completed`: update session state, mark agent idle, check for pending sessions
- On disconnect: if agent had active session, set session back to pending, remove from registry

## WebSocket: UI Channel (packages/server/src/ws/ui-ws.ts)

Handle `/ws/ui`:
- On connect: add to subscribers set
- Broadcast session:updated, message:created, thinking:stream, token:stream, message:complete events

## Connection Registry (packages/server/src/ws/connections.ts)

In-memory maps:
- `agents`: Map<agentId, { ws, currentSessionId }>
- `uiClients`: Set<WebSocket>
- Functions: getIdleAgent(), broadcastToUi(), sendToAgent()

## Dispatch Logic (packages/server/src/ws/dispatch.ts)

When a session is created or an agent becomes idle:
- Find idle agent
- Load session + messages from DB
- Send session:assign to agent
- Update session state to active

## Server Entry Point (packages/server/src/index.ts)

- Create Hono app with @hono/node-server and @hono/node-ws
- Initialize DB connection, run schema.sql if tables don't exist
- Mount routes and WebSocket handlers
- Serve static UI files from ./ui-dist in production

## Verification

1. `pnpm build` succeeds
2. Start Postgres + server
3. `curl POST /api/sessions` creates a session, returns it
4. `curl GET /api/sessions` lists sessions
5. WebSocket connection to /ws/agent and /ws/ui establishes (test with wscat or similar)
6. Send agent:register with correct secret → accepted
7. Send agent:register with wrong secret → rejected

## On Completion

Update `docs/progress.md`. Commit with message: "Phase 2 — server HTTP API and WebSocket handlers"
