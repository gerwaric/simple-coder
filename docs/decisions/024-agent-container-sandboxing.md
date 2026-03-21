# Agent Container Sandboxing
**Status:** Accepted
**Date:** 2026-03-20
**Source:** [Conversation 005](../conversations/005-phase-13-testing-and-ui-polish.md)

## Context
The agent container runs with tools that can execute arbitrary shell commands and read/write files. While the Docker container provides isolation from the host, within the container the agent had full root-level access to all files. The approval flow gates mutating operations (bash, write_file) but read_file executes without approval and could access any file in the container.

## Decision
Harden the agent container with three layers:
1. **Non-root user**: The Dockerfile already creates an `agent` user (from Phase 12) with ownership of `/workspace`. The agent process runs as this user.
2. **Read-only filesystem**: `read_only: true` in docker-compose.yml makes the container filesystem immutable. The agent cannot modify system files, installed packages, or its own application code.
3. **Writable exceptions via volumes/tmpfs**:
   - `/workspace` — named Docker volume, writable, persistent (the actual work area)
   - `/home/agent` — named Docker volume, writable, persistent (git config, ssh keys, npm cache)
   - `/tmp` — tmpfs, writable, ephemeral (temp files cleared on restart)

## Consequences
- The agent can only write to /workspace, /home/agent, and /tmp — all other paths are read-only
- The workspace volume persists across container restarts and is shared across all sessions
- The /home/agent volume preserves git config, shell history, and tool configuration between restarts
- The approval flow remains the primary safety gate for consequential operations — sandboxing is defense in depth
- Path validation on read_file/write_file was not added since the approval flow already covers write_file and bash; read_file accessing system files is low-risk within the container
