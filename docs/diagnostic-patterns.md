# Diagnostic Patterns

System-specific debugging knowledge accumulated during development. These patterns are non-obvious and specific to the simple-coder architecture.

## Stale Sessions After Volume Rebuild
**Symptom:** Agent is assigned a session from a previous test, not the one you just created. Session UUID in logs doesn't match what you expect.
**Check:** Compare the session UUID in agent logs to the one returned by your POST to /api/sessions. Run `curl http://localhost:3000/api/sessions` to see all sessions and their states.
**Root Cause:** The postgres volume persists across `docker compose down` / `docker compose up`. Old sessions remain in the DB. If an old session is still `pending` or `active`, the server may dispatch it before your new session.
**Resolution:** `docker volume rm simple-coder_pgdata` before starting, or manually clean up sessions via the DB.
**Learned:** 2026-03-20

## Docker Build Cache With Stale dist/
**Symptom:** Code changes to agent or server source don't take effect after `docker compose up --build`. Container logs show old behavior.
**Check:** Look at the docker build output for `CACHED` on the `COPY packages/agent/` or `COPY packages/server/` layers. Check if the `dist/` directory was rebuilt on the host.
**Root Cause:** Docker caches the COPY layer based on file contents. If you edited source in `src/` but didn't run `pnpm build` on the host, the `dist/` directory is stale. The Dockerfile does run its own build, but the COPY layer cache key doesn't see the src changes because it copies the whole package directory including dist.
**Resolution:** Run `pnpm build` (or `pnpm --filter @simple-coder/agent build`) on the host before `docker compose up --build`.
**Learned:** 2026-03-20

## Agent ID Mismatch After Partial Restart
**Symptom:** Sessions are assigned but the agent never processes them. Server logs may show the session dispatched to a different agent ID than the one currently connected.
**Check:** Compare `agentId` in `curl http://localhost:3000/api/sessions` response with the agent ID in `docker compose logs agent`.
**Root Cause:** Restarting only the agent container while the server keeps running leaves stale agent connection state. The server's in-memory map may have dispatched sessions to the old (now-dead) agent WebSocket before the new agent connected.
**Resolution:** Always restart all containers together: `docker compose down && docker compose up --build -d`. Don't restart individual services during debugging.
**Learned:** 2026-03-20

## Agent Silent After Session Assignment
**Symptom:** Agent logs show "assigned session ..." but nothing after. No LLM calls, no tool calls, no errors.
**Check:** Add debug logging to `runToolLoop` entry and the `streamText` call. Check if the LLM API key is valid and accessible from the container.
**Root Cause:** Could be several things — API key issue, network issue from container, or the session was already complete (agent processes it, LLM returns text with no tool calls, loop exits silently). Check if the agent sent `turn:complete` — if so, the turn finished successfully but produced no visible output because the conversation was already answered.
**Resolution:** Check `docker compose logs agent` for `turn complete` messages. If present, the agent processed the session but there was nothing new to do.
**Learned:** 2026-03-20
