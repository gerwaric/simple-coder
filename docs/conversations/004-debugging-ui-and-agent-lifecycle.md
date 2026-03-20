# Debugging: UI and Agent Lifecycle
**Date:** 2026-03-20
**Type:** Debugging / Bugfixing

## Bugs Fixed
- Agent never releases after turn completes, blocking new sessions — [ADR-019](../decisions/019-turn-complete-idle-signaling.md)
- Duplicate approval cards in UI due to toolCallId matching without role check — implementation fix (commit cf03efe)
- Stale session assignment after container restart due to postgres volume persistence — resolved by understanding the lifecycle; fix is ADR-019

## Decisions Made
- [ADR-019: Turn-Complete Idle Signaling](../decisions/019-turn-complete-idle-signaling.md)
- [ADR-020: Bug Documentation Strategy](../decisions/020-bug-documentation-strategy.md)

## Diagnostic Notes

### Duplicate Approval Cards

**Symptom:** When approving a tool call, the approval card appeared twice — once with pending state, then a second card showing the approved state.

**Diagnosis:** Traced the WebSocket message flow. When `tool:approval:request` arrives, the UI creates a synthetic message with `id: toolCallId`. After approval, the server broadcasts `message:complete` with the DB message, which has a different `id` (the DB UUID) but the same `toolCallId`. The `upsertMessage` function matched only by `id`, so it didn't find the synthetic message and added a duplicate.

**Root Cause:** `upsertMessage` in `useSessions.ts` only matched messages by `id`. Synthetic messages created from WebSocket events used `toolCallId` as their `id`, but persisted messages from the server had different DB-generated UUIDs.

**Fix:** Added `toolCallId` + `role` matching to `upsertMessage`. The `role` check prevents a `tool_result` from replacing a `tool_call` that shares the same `toolCallId`.

### Agent Not Responding to New Sessions

**Symptom:** After the first session worked end-to-end, creating a second session resulted in the user message appearing but no agent response. Agent logs showed no activity.

**Diagnosis:** This was a multi-layered investigation:

1. Added debug logging to `runToolLoop` — confirmed the LLM call started and streamed successfully
2. Noticed the session UUID in agent logs was the same across container rebuilds — postgres volume persisted old sessions
3. Discovered the agent was being assigned the old (already-answered) session, processing it silently, then going idle
4. Realized the agent never sent any completion signal after `runToolLoop` finished
5. Verified by running the stack directly: created session 1, waited for completion, created session 2 — session 2 stayed `pending` forever because the server still considered the agent busy

**Root Cause:** The `runToolLoop` method in `connection.ts` had no post-completion notification. The server tracked agent availability via `currentSessionId` (null = idle). After the tool loop broke (no more tool calls), the agent just returned from the function with no signal to the server. The `session:stop` handler sent `agent:ready`, and the `session:completed` handler cleared the agent, but the natural completion path had no equivalent.

**Fix:** Added `turn:complete` message type (see ADR-019). Agent sends it after each `runToolLoop`. Server clears agent assignment and dispatches pending sessions. For follow-up messages to released sessions, the server re-dispatches via the normal session assignment flow.

### Docker Build Cache Not Picking Up Changes

**Symptom:** After modifying agent source code and running `docker compose up --build`, the agent container logs showed no debug output — the old code was still running.

**Diagnosis:** The Docker build output showed `CACHED` for the `COPY packages/agent/` layer. The source files in the repo had changed, but the build output in `dist/` hadn't been regenerated. Docker cache compared the `dist/` directory contents, which were stale.

**Root Cause:** The Dockerfile copies from `packages/agent/` which includes `dist/`. If `pnpm build` isn't run on the host before `docker compose build`, the container gets stale build artifacts.

**Fix:** Run `pnpm --filter @simple-coder/agent build` on the host before `docker compose up --build`, or the Dockerfile's own `RUN pnpm build` step will rebuild from the copied source. The issue was that the COPY layer was cached because the host `dist/` files hadn't changed.

### Stale Agent Assignment After Container Restart

**Symptom:** After `docker compose up --build -d agent` (restarting only the agent), new sessions were assigned to a dead agent ID.

**Diagnosis:** The server container was NOT restarted. Its in-memory agent connection map still referenced the old agent. When a new session was created, the server dispatched it to the old (now-disconnected) agent WebSocket. The new agent connected with a different ID but the server had already assigned the session.

**Root Cause:** Restarting only the agent container while keeping the server running leaves stale agent connection state on the server. The server's in-memory map had the old agent as "idle" (it had processed the close event but the session was already dispatched).

**Fix:** Always restart all containers together, or the server needs to handle agent reconnection more gracefully (not addressed — operational workaround is sufficient for dev).

## Discussion

### Phase 11 and 12 Implementation

**Tom:** Asked to implement Phase 11 (UI Updates) and Phase 12 (Docker + Integration), reading the prompts and existing code first.

**Claude:** Read all relevant files, proposed a bottom-up implementation plan (API helpers → components → state management → wiring). Tom approved. Implemented Phase 11 (4 new components, updates to 5 existing files) and Phase 12 (Dockerfile, docker-compose, .env updates). Both phases built cleanly with 60 tests passing.

### First Bug: Duplicate Approval Cards

**Tom:** Reported that after approving a tool call, the approval card appeared a second time in the UI, showing the approved state as a duplicate.

**Claude:** Identified the ID mismatch between synthetic WebSocket messages (using toolCallId as id) and persisted DB messages (using a separate UUID). Fixed by adding toolCallId+role matching to upsertMessage.

### Second Bug: Agent Not Responding

**Tom:** Started a new session with "What is the current directory" and nothing happened — message bubble appeared but no agent response.

**Claude:** Initially couldn't determine from code alone whether this was UI, agent, or connection issue. Asked Tom for container logs. Logs showed the agent was assigned the session but produced no output after "starting stream...".

**Tom:** Shared the docker console output showing the agent was assigned but silent.

**Claude:** Noticed the session UUID was the same as the earlier test — postgres volume had persisted. Identified that the agent was processing the old session and never signaling completion. Verified by tracing the code: `runToolLoop` exits the while loop when the LLM responds with no tool calls, but nothing happens after that.

### Running the Stack Directly

**Tom:** Asked if Claude could run the server/agent/DB directly for faster debugging cycles.

**Claude:** Confirmed all prerequisites were available (docker compose, .env with API key). Discussed using a cheaper model (Haiku) but decided to keep Sonnet since the API costs were acceptable.

**Claude:** Ran the full stack via docker compose, created sessions via curl, approved tool calls, and verified the complete flow. Confirmed the turn:complete fix resolved the multi-session issue and that follow-up messages to released sessions worked correctly.

### Bug Documentation Strategy

**Tom:** Asked whether bugs should be documented in a separate docs/bugs/ folder or in the existing decisions folder. Noted that one bug might lead to multiple decisions, and wanted to maintain the spirit of the project's documentation approach.

**Claude:** Proposed that bugs don't need their own folder. Architecture-changing bugs become ADRs (the bug is the Context section). Implementation fixes are covered by commit messages. Diagnostic patterns go in a separate file. Tom agreed.

**Tom:** Asked whether to create a new skill for bugfix/troubleshooting session wrap-up.

**Claude:** Created `/bugfix-wrapup` command that classifies bugs, generates ADRs for architecture changes, creates diagnostic-focused conversation notes, and maintains a diagnostic patterns file. Tested it on the current session.
