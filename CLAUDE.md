# Simple-Coder

## Why

HumanLayer take-home assessment. Evaluates **design thinking and architecture**, not feature completeness. Prioritize simplicity and clean design over shipping features. Start minimal, iterate deliberately.

## What

Sync-based headless coding agent: server (Hono + Postgres), agent daemon (Vercel AI SDK), UI (React + Vite). Three containers via Docker Compose.

- `packages/shared/` — shared types and constants (all packages depend on this)
- `packages/server/` — Hono API + WebSocket + Postgres
- `packages/agent/` — headless agent daemon (connects outbound to server)
- `packages/ui/` — React + Vite frontend

For architecture details, read `docs/implementation-plan.md`. For design rationale, read `docs/decisions/`.

## How

```bash
pnpm install              # install dependencies
pnpm build                # build all packages
pnpm dev:server           # run server in dev mode
pnpm dev:agent            # run agent in dev mode
pnpm dev:ui               # run UI in dev mode
pnpm test                 # run tests
docker compose up --build # run everything in containers
```

## Commits

Small, intentional commits. Meaningful messages. Each implementation phase gets at least one commit.

## Documentation

Use `/conversation-notes` after planning sessions to generate conversation records and ADRs. Do not create ADRs manually.
