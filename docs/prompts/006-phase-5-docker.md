# Phase 5: Docker Compose

Read `docs/implementation-plan.md` and `docs/progress.md` for full context.

## Task

Create Dockerfiles and docker-compose.yml so a reviewer can run the entire system with `docker compose up --build` after configuring `.env`.

## docker/Dockerfile.server

Multi-stage build:

1. **base**: node:20-alpine, enable pnpm, copy package.json files, install dependencies
2. **build**: copy source, build shared → ui → server, copy ui dist into server's serving directory
3. **runtime**: node:20-alpine, copy built server + node_modules, CMD node index.js

The server serves the built UI static files via Hono's serveStatic middleware.

## docker/Dockerfile.agent

Ubuntu-based (spec requires "e.g. ubuntu"):

1. ubuntu:24.04, install Node.js 20 + pnpm
2. Copy package.json files, install dependencies
3. Copy source, build shared → agent
4. CMD node packages/agent/dist/index.js

**No ports exposed.**

## docker-compose.yml

Three services:

**postgres:**
- image: postgres:16-alpine
- env: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD from .env
- volume: pgdata for persistence
- healthcheck: pg_isready

**server:**
- build: context . dockerfile docker/Dockerfile.server
- ports: ${SERVER_PORT:-3000}:3000
- env: POSTGRES_* vars, pointing to postgres hostname
- depends_on: postgres (healthy)

**agent:**
- build: context . dockerfile docker/Dockerfile.agent
- env: SERVER_WS_URL=ws://server:3000/ws/agent, LLM_PROVIDER, LLM_API_KEY, LLM_MODEL, LLM_BASE_URL, AGENT_SECRET
- depends_on: server
- **No ports**

## .env.example

Ensure it has all required variables with clear comments and placeholder values.

## Verification

1. `cp .env.example .env` and fill in LLM_API_KEY and adjust AGENT_SECRET
2. `docker compose up --build`
3. Postgres starts and is healthy
4. Server starts, connects to Postgres, creates tables
5. Agent starts, connects to server, registers
6. Open http://localhost:3000 → UI loads
7. Create session → agent responds with streaming
8. Full end-to-end works with zero manual steps beyond .env

## On Completion

Update `docs/progress.md`. Commit with message: "Phase 5 — Docker Compose for full-stack deployment"
