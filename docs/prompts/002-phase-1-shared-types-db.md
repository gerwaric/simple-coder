# Phase 1: Shared Types + Database

Read `docs/implementation-plan.md` and `docs/progress.md` for full context.

## Task

Define all shared types, constants, and WebSocket message schemas. Implement the database layer with schema, connection, and query functions.

## Shared Package (packages/shared/src/)

**types.ts:**
- `Session` interface (id, state, agentId, title, createdAt, updatedAt)
- `Message` interface (id, sessionId, role, content, thinking, createdAt)

**constants.ts:**
- `SessionState` — pending, active, completed, stopped
- `MessageRole` — user, assistant, system

**ws-messages.ts:**
- Discriminated union types for agent↔server channel (agent:register with secret, agent:ready, session:assign, user:message, thinking:token, thinking:complete, assistant:token, assistant:message:complete, tool:call placeholder, tool:result placeholder, session:stop, session:completed)
- Discriminated union types for server→UI channel (session:updated, message:created, thinking:stream, token:stream, message:complete, tool:call placeholder, tool:result placeholder)

**index.ts:** barrel exports

## Server Database Layer (packages/server/src/db/)

**schema.sql:** sessions and messages tables per the plan

**index.ts:** Postgres connection using `postgres` package, configured from env vars

**queries.ts:** Pure functions taking the sql instance:
- createSession, getSession, listSessions, updateSessionState
- createMessage, getMessages

## Verification

1. `pnpm build` succeeds
2. Start a Postgres instance (docker run), run schema.sql
3. A small test script can insert and read sessions and messages
4. Shared types import correctly in server package

## On Completion

Update `docs/progress.md`. Commit with message: "Phase 1 — shared types and database layer"
