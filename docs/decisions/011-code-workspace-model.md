# Code Workspace Model
**Status:** Accepted
**Date:** 2026-03-19
**Source:** [Conversation 002](../conversations/002-coding-agent-design.md)

## Context

The coding agent needs access to source code. The agent runs in a separate ubuntu container with no open ports, connecting outbound to the server. The project definition requires `docker compose up` to work with no additional build steps.

We considered three options: code in the agent container, code on the server (agent fetches/pushes), and code mounted via Docker volume.

## Decision

Code lives in the agent container. The user directs the agent to clone repos via the `bash` tool (e.g., `git clone`). The workspace is a directory in the agent container. No special session-to-repo binding — the user says "clone this repo" and the agent runs `git clone`.

Secrets like `GITHUB_TOKEN` for private repos are passed via the existing `.env` pattern, extending what's already used for `LLM_API_KEY` and `AGENT_SECRET`. No new secret management infrastructure.

The agent does not auto-clone or auto-explore on session start. It waits for user direction. This supports flexible workflows — the user might clone multiple repos, create a monorepo structure, or work with code that's already in the container.

## Consequences

- The server remains a stateless broker — it never touches files
- The agent container Dockerfile needs `git` and basic dev tools (`build-essential`, `curl`, `node`)
- Docker Compose passes additional env vars (like `GITHUB_TOKEN`) to the agent container
- `.env.example` documents optional variables
- No special infrastructure for repo management — git via bash covers it
- The workspace is ephemeral — it lives and dies with the container
