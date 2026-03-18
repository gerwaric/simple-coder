# Phase 7: Polish

Read `docs/implementation-plan.md` and `docs/progress.md` for full context.

## Task

Add error handling, resilience, and the README. This is the final phase before the project is submission-ready.

## Error Handling

- Agent reconnection with exponential backoff (may already be implemented — verify)
- Server handles agent disconnect gracefully: active session → pending
- UI shows connection status (connected/disconnected banner), auto-reconnects
- API input validation: check session exists, check session is in correct state for the operation
- Graceful shutdown: agent finishes current LLM turn before exiting on SIGTERM

## README.md

Must include (per spec):

1. **Project overview** — stack, architecture (ASCII diagram from plan), design decisions
2. **Setup instructions** — clone, copy .env.example, fill in API key, docker compose up
3. **Architecture section** — the three-component model, WebSocket protocol, session lifecycle
4. **Design decisions** — link to docs/decisions/ for details, summarize key choices:
   - Why zero tools first
   - Why thinking tokens in the protocol
   - The extensibility path (tool calls, human-in-the-loop)
   - Agent authentication
5. **AI coding agent usage** — which agent (Claude Code), methodology, link to .claude/ directory
6. **Demo video placeholder** — note that a Loom video will be added

## Final Checks

- `docker compose up --build` works from clean state
- UI is functional and shows real-time streaming
- All tests pass
- Git history tells a clear story
- .claude/ directory is committed
- No secrets in committed files

## On Completion

Update `docs/progress.md` — mark all phases complete. Commit with message: "Phase 7 — error handling, README, and polish"
