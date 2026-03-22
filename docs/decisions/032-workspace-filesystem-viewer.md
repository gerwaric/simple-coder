# Workspace Filesystem Viewer
**Status:** Accepted
**Date:** 2026-03-22
**Source:** [Conversation 008](../conversations/008-filesystem-viewer-and-token-budget.md)

## Context

The user had no way to see what files the agent had created or modified in the workspace. The only visibility was through agent messages describing its actions. A read-only file browser would let the user verify agent work without leaving the UI.

## Decision

Add a read-only filesystem viewer as a toggleable right-side panel in the UI. The server exposes the workspace via two REST endpoints (`GET /api/files` for directory listing, `GET /api/files/read` for file contents). The agent and server share a Docker volume (`workspace`); the server mounts it read-only.

Key details:
- **Path validation** reuses the ADR-028 pattern: `path.resolve` against workspace root, reject if relative path starts with `..`
- **`WORKSPACE_DIR` env var** configures the workspace path (default: `/workspace` in Docker, `.workspace/` relative to project root for local dev)
- **1MB file size limit** prevents the server from loading huge files
- **Lazy-loading tree** — directories fetch children on expand, not upfront
- **Draggable panel width** — left edge drag handle, 200px–800px range

The workspace is shared across all sessions (not per-session).

## Consequences

- Users can browse and verify agent-created files without SSH or terminal access
- Read-only mount on the server prevents accidental writes through the file API
- The same workspace path resolution logic is used in both the agent (`tool-executor.ts`) and server (`routes/files.ts`), fixing a local dev bug where both previously fell back to their own CWD instead of the project-root `.workspace/` directory
- The `.workspace/` directory is gitignored for local development
- No database changes required — purely filesystem and UI
