# Phase 6: Testing

Read `docs/implementation-plan.md` and `docs/progress.md` for full context.

## Task

Add deterministic integration tests that validate the session lifecycle end-to-end. These tests should catch regressions when infrastructure changes are made.

## Test Setup

- Test runner: vitest
- Tests use a real Postgres instance (via docker, same as dev)
- LLM is mocked — tests inject a deterministic LlmClient that returns fixed responses
- Tests spin up the server programmatically and connect test agents/clients via WebSocket

## Test Cases

**Session creation:**
- POST /api/sessions creates session with state=pending
- Session appears in GET /api/sessions list
- GET /api/sessions/:id returns session with messages

**Agent authentication:**
- Agent connecting with valid AGENT_SECRET is accepted
- Agent connecting with invalid AGENT_SECRET is rejected (connection closed)

**Session dispatch:**
- When an idle agent is connected and a session is created, session is dispatched (state=active)
- When no agent is connected, session stays pending
- When agent becomes ready and pending session exists, session is dispatched

**Message flow:**
- Agent receives session:assign with session and message history
- Agent sends assistant:message:complete → message is persisted in DB
- User sends follow-up message → agent receives user:message
- UI client receives token:stream and message:complete events

**Session stop:**
- POST /api/sessions/:id/stop sets state=stopped
- Agent receives session:stop

**Agent disconnect:**
- When agent disconnects with active session, session returns to pending
- When a new agent connects and signals ready, pending session is dispatched

## File Structure

```
packages/server/src/__tests__/
├── setup.ts           # Start Postgres, run schema, create test helpers
├── sessions.test.ts   # HTTP API tests
├── agent-ws.test.ts   # Agent WebSocket tests
└── lifecycle.test.ts  # Full session lifecycle integration test
```

## Verification

1. `pnpm test` runs all tests
2. All tests pass with mocked LLM (no API key needed)
3. Tests are deterministic — no flaky timing dependencies

## On Completion

Update `docs/progress.md`. Commit with message: "Phase 6 — integration tests for session lifecycle"
