# Simple-Coder — Claude Code Conventions

## Project Overview

A sync-based headless coding agent system with three components: server (Hono + Postgres), agent daemon (Vercel AI SDK), and UI (React + Vite). See `docs/implementation-plan.md` for full architecture.

## Monorepo Structure

- `packages/shared/` — shared types and constants (all other packages depend on this)
- `packages/server/` — Hono API server + WebSocket + Postgres
- `packages/agent/` — headless coding agent daemon
- `packages/ui/` — React + Vite frontend
- pnpm workspaces, tsup for server/agent builds, Vite for UI

## Documentation Conventions

### Architecture Decision Records (ADRs)

- Stored in `docs/decisions/NNN-slug.md`
- Use the ADR template defined in `docs/implementation-plan.md`
- Created via the `/conversation-notes` command (not manually)

### Conversation Notes

- Stored in `docs/conversations/NNN-slug.md`
- Near-verbatim records of planning conversations — preserve the dialogue, don't summarize
- Created via the `/conversation-notes` command

### Cross-linking

- Each conversation note lists the ADRs it produced
- Each ADR links back to its source conversation

## Commit Conventions

- Small, intentional commits that tell a story in the git history
- Each implementation phase gets at least one commit
- Commit messages should be meaningful and descriptive

## Key Design Principles

- Start minimal, iterate deliberately — simplicity over features
- The server is the stateless broker; Postgres is the source of truth
- The agent connects outbound only (no exposed ports)
- The WebSocket protocol uses discriminated unions on a `type` field
- `LlmClient` is stateless and reusable — designed to support sub-agent patterns
