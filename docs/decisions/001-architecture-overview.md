# Architecture Overview
**Status:** Accepted
**Date:** 2026-03-18
**Source:** [Conversation 001](../conversations/001-initial-planning.md)

## Context

The HumanLayer assessment requires a sync-based headless coding agent system with three components: server, agent daemon, and UI. The server manages a database and provides APIs. The agent connects outbound only (no exposed ports). The UI must show agent work in real-time.

## Decision

- **Server**: Hono + @hono/node-server + @hono/node-ws, serving HTTP API, WebSocket, and static UI files on a single port
- **Database**: Postgres 16 via `postgres` (porsager) — no ORM, raw SQL for two tables
- **Agent**: Vercel AI SDK for LLM abstraction (supports Anthropic, OpenAI, OpenAI-compatible/llama.cpp)
- **UI**: React + Vite (no Next.js per spec constraint)
- **Monorepo**: pnpm workspaces with `packages/shared`, `packages/server`, `packages/agent`, `packages/ui`
- **Builds**: tsup for server/agent, Vite for UI, tsx for dev mode
- **Real-time**: WebSocket on two paths — `/ws/agent` (agent↔server) and `/ws/ui` (server→UI)
- **Docker Compose**: server+UI container, Postgres container, agent container (ubuntu, no exposed ports)

The server acts as a stateless broker. All persistent state lives in Postgres. Agents connect outbound and receive session dispatch from the server.

## Consequences

- Single port simplifies Docker config and eliminates CORS issues
- Two WS paths keep agent and UI concerns cleanly separated with distinct trust models
- No ORM means less abstraction overhead but manual SQL for any schema changes
- Vercel AI SDK provides provider flexibility but adds a dependency
- pnpm workspaces requires all packages to be built in dependency order
