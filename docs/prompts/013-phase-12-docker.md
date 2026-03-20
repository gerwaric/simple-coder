# Phase 12: Docker + Integration

Read `docs/coding-agent-plan.md` and `docs/progress.md` for full context.

## Task

Update the Docker setup so the agent container can function as a coding agent: git, dev tools, and proper environment. Verify end-to-end in containers.

## Agent Dockerfile (docker/Dockerfile.agent)

Update to include coding tools:
- `git` — required for cloning repos
- `build-essential` — C/C++ compiler for native modules
- `curl` — downloading things
- `nodejs` + `npm` — since this is a TypeScript project (agent may need to run node projects)
- Set up a `/workspace` directory as the default working directory for the agent
- Ensure the agent process runs as a non-root user (security best practice for sandboxing)

Example additions:
```dockerfile
RUN apt-get update && apt-get install -y \
  git \
  build-essential \
  curl \
  && rm -rf /var/lib/apt/lists/*

# Install Node.js (for projects the agent works on)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y nodejs

RUN mkdir -p /workspace
WORKDIR /workspace
```

## docker-compose.yml

Update the agent service:
- Pass `GITHUB_TOKEN` environment variable (optional, from .env)
- Ensure the workspace directory exists
- Verify no ports are exposed (existing constraint)

```yaml
agent:
  environment:
    - GITHUB_TOKEN=${GITHUB_TOKEN:-}
    - LLM_MAX_TOKENS=${LLM_MAX_TOKENS:-128000}
    # ... existing env vars
```

## .env.example

Add optional variables:
```env
# Optional — for cloning private repos
GITHUB_TOKEN=

# Optional — context window size for budget tracking (default: 128000)
LLM_MAX_TOKENS=128000
```

## Verification

1. `docker compose build` succeeds
2. `docker compose up` — all services start
3. Exec into agent container: `docker compose exec agent bash`
   - Verify `git --version` works
   - Verify `node --version` works
   - Verify `/workspace` directory exists
4. From the UI, create a session and ask the agent to clone a public repo
5. Approve the bash command
6. Agent clones the repo, can read files from it
7. Full end-to-end: ask the agent to read a file from the cloned repo, then make a change
8. Verify approval flow works through the UI in Docker

## On Completion

Update `docs/progress.md`. Commit with message: "Phase 12 — Docker setup for coding agent"
