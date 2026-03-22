# Phase 15: Workspace Filesystem Viewer

Read `docs/coding-agent-plan.md`, `docs/progress.md`, and `docs/humanlayer-dossier.md` for full context.

## Task

Add a read-only filesystem viewer so the user can browse the agent's workspace from the UI. The server serves files via a shared volume; the agent is not involved.

## Architecture

The agent container and server container share a Docker volume mounted at `/workspace`. The server gets a **read-only** mount. Two new REST endpoints expose the filesystem. A new UI panel displays a file tree and file contents.

### Server: File API

Add `packages/server/src/routes/files.ts` with two endpoints:

**`GET /api/files?path=`**
- Lists directory contents at the given path (default: `/`)
- Returns array of `{ name, type: "file" | "directory", size, modifiedAt }`
- Path is relative to the workspace root
- Validate paths: reject `..` traversal, ensure path stays within workspace
- Return 404 for non-existent paths

**`GET /api/files/read?path=`**
- Returns file contents as plain text
- Path is relative to workspace root
- Same path validation as above
- Return 404 for non-existent paths, 400 for directories
- Consider a size limit (e.g. 1MB) to avoid sending huge files

### Configuration

- `WORKSPACE_DIR` environment variable (default: `/workspace` in Docker, `./workspace` for local dev)
- Server reads this on startup
- Add to `.env.example` and `docker-compose.yml`

### Docker Compose

- Add a named volume shared between server and agent containers
- Server mounts it read-only: `workspace:/workspace:ro`
- Agent mounts it read-write: `workspace:/workspace`

### UI: File Browser Panel

Add a file browser panel to the right side of the main layout (or as a toggleable drawer). Components:

**FileTree** — collapsible directory tree
- Lazy-loads directory contents on expand (click to fetch children)
- Shows file/directory icons (can be simple text: `>` for dirs, `-` for files)
- Click a file to view its contents

**FileViewer** — displays selected file contents
- Shows file path as header
- Monospace text display with line numbers
- Scroll for large files

**Integration with App.tsx**
- Add a toggle button to show/hide the file panel
- Panel sits alongside the chat panel, not replacing it

### API Client

Add to `packages/ui/src/api.ts`:
- `listFiles(path?: string)` — calls GET /api/files
- `readFile(path: string)` — calls GET /api/files/read

## Verification

- [ ] `GET /api/files` returns workspace root listing
- [ ] `GET /api/files?path=src` returns subdirectory listing
- [ ] `GET /api/files/read?path=package.json` returns file contents
- [ ] Path traversal (`../etc/passwd`) is rejected
- [ ] UI shows file tree, clicking directories expands them
- [ ] UI shows file contents when a file is clicked
- [ ] Works in Docker Compose with shared volume
- [ ] Works in local dev with WORKSPACE_DIR pointing at a local directory
- [ ] Existing tests still pass (63 tests)

## Notes

- This is read-only — the user cannot edit files from this panel. Editing happens through the agent.
- Keep the UI simple. This is a viewer, not an IDE.
- Path validation is security-critical — use the same approach as ADR-028 (tool path validation).
