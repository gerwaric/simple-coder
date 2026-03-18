# Phase 0: Project Scaffolding

Read `docs/implementation-plan.md` and `docs/progress.md` for full context.

## Task

Set up the monorepo structure with all root and package configuration files. Nothing should contain real logic yet — just the skeleton that builds.

## Files to Create

**Root:**
- `package.json` — pnpm workspace root with scripts for dev:server, dev:agent, dev:ui, build, test
- `pnpm-workspace.yaml` — packages/*
- `tsconfig.base.json` — shared TypeScript compiler options
- `.gitignore` — node_modules, dist, .env, etc.
- `.env.example` — all required env vars with placeholder values (AGENT_SECRET, LLM_PROVIDER, LLM_API_KEY, LLM_MODEL, LLM_BASE_URL, POSTGRES_*, SERVER_PORT)

**packages/shared:**
- `package.json` (@simple-coder/shared)
- `tsconfig.json` (extends root)
- `tsup.config.ts`
- `src/index.ts` — empty barrel export

**packages/server:**
- `package.json` (@simple-coder/server, depends on @simple-coder/shared)
- `tsconfig.json`
- `tsup.config.ts`
- `src/index.ts` — minimal Hono app that responds to GET / with "simple-coder server"

**packages/agent:**
- `package.json` (@simple-coder/agent, depends on @simple-coder/shared)
- `tsconfig.json`
- `tsup.config.ts`
- `src/index.ts` — console.log("simple-coder agent starting...")

**packages/ui:**
- `package.json` (@simple-coder/ui)
- `tsconfig.json`
- `vite.config.ts` — React plugin, proxy config for /api and /ws
- `index.html`
- `src/main.tsx` — renders a div with "simple-coder ui"
- `src/App.tsx` — minimal component

## Verification

1. `pnpm install` succeeds
2. `pnpm build` succeeds (all packages produce output)
3. Each package can import from @simple-coder/shared

## On Completion

Update `docs/progress.md` — mark Phase 0 as completed with the commit hash. Commit with message: "Phase 0 — project scaffolding"
