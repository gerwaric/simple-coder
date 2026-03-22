# Phase 15: Filesystem Viewer and Token Budget
**Date:** 2026-03-22

## Decisions Made
- [ADR-032: Workspace Filesystem Viewer](../decisions/032-workspace-filesystem-viewer.md)
- [ADR-033: Configurable Token Budget](../decisions/033-configurable-token-budget.md)

## Discussion

### Reading the Phase 15 Prompt

**Tom:** Please read docs/prompts/016-phase-15-filesystem-viewer.md and work back and forth with me with any open questions as you get started.

**Claude:** Read the prompt and supporting files (progress.md, docker-compose.yml, existing routes, app.ts, api.ts). Raised five open questions:

1. **Path validation approach** — The prompt references "ADR-028 (tool path validation)". Should I look it up for the specific validation approach, or is a standard `path.resolve` + prefix check sufficient?
2. **Session-scoped vs global workspace** — Is the workspace shared across all sessions, or does each agent session get a subdirectory?
3. **UI layout preference** — Right side panel or toggleable drawer? Leaning toward toggleable right panel since it keeps the chat usable at full width.
4. **The file routes don't need `sql`** — Unlike the other routes, these are pure filesystem operations. Will skip the sql parameter.
5. **Local dev workspace** — Should I create a `.workspace` dir in the project root, or point somewhere specific?

**Tom:** For 2, the sessions share the workspace. For 3, I agree, make sure it has a modern professional design. This isn't a front-end project, but I would like it to look decent and discoverable. For 4, that makes sense. For 5, I'm not sure, sounds like we should create a .workspace dir. For 1, can you double check? I see docs/decisions/028-tool-path-validation.md, maybe this is what the prompt should have referred to.

**Claude:** Yes, ADR-028 is exactly what the prompt refers to. The approach is: `path.resolve(workspaceRoot, requestedPath)`, compute relative path back from workspace root, reject if it starts with `..`. Confirmed the plan: server routes, Docker volume config, UI components, `.workspace/` gitignored directory.

**Tom:** Yes, go ahead.

### Implementation

Claude implemented the full feature:

- **Server:** `packages/server/src/routes/files.ts` with `GET /api/files` (directory listing) and `GET /api/files/read` (file contents, 1MB limit). ADR-028 style path validation. Mounted in `app.ts`.
- **Docker:** Added `workspace:/workspace:ro` volume mount and `WORKSPACE_DIR` env var to server container.
- **Config:** Added `WORKSPACE_DIR` to `.env.example`, `.workspace/` to `.gitignore`.
- **UI:** `FileTree` component (lazy-loading collapsible tree with refresh), `FileViewer` component (monospace with line numbers), API client functions (`listFiles`, `readFileContent`), toggleable "Files" button in top-right of chat panel opening a right-side panel split 40/60 between tree and viewer.

Build passed, all 63 tests passed.

### Debugging: File Listing 404

**Tom:** I see the popout side panel, but I get an error "Failed to list files: 404" and retrying doesn't work. I don't see any console messages on the server, agent, or UI. How can we troubleshoot?

**Claude:** Tested the endpoint directly with curl — confirmed 404. The issue was the default `WORKSPACE_DIR` of `.workspace` resolving relative to the server's CWD (`packages/server/`), so it tried `packages/server/.workspace` which doesn't exist, causing `ENOENT` which mapped to 404.

Fixed the server's `getWorkspaceDir()` to: use `WORKSPACE_DIR` env var if set, else check if `/workspace` exists (Docker), else fall back to `resolve(process.cwd(), "../../.workspace")` (project root).

### Agent Writing to Wrong Directory

**Tom:** I'm running the agent locally. When I asked it to create a text file, it wrote into the ./packages/agent/ directory instead of the .workspace directory. What do you think caused this, and what are the options for making the agent create stuff in the workspace by default instead?

**Claude:** Same bug as the server. The agent's `resolveWorkspace()` tries `WORKSPACE_DIR` (not set), then `/workspace` (doesn't exist on host), then falls back to `process.cwd()` which is `packages/agent/`. Three options: set env var manually, mirror the server fix in agent code, or add it to the dev script. Recommended option 2 (code fix).

**Tom:** Yes, let's do that, and does .workspace need to be added to .gitignore?

**Claude:** Already added `.workspace/` to `.gitignore` earlier. Applied the same fix to `packages/agent/src/tool-executor.ts`.

### Database Schema Error

**Tom:** I got an error "Failed to create session: 500" when I tried to create a new session. Server console shows Postgres error 42703 (undefined column) at `createSession`.

**Claude:** The `include_claude_md` column was added to the schema definition but `CREATE TABLE IF NOT EXISTS` doesn't add columns to existing tables. Suggested running `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS include_claude_md BOOLEAN NOT NULL DEFAULT false;` against the database. This was from a prior phase's work, not the file panel changes.

### UI Polish: Files Button Size

**Tom:** Please make the text of the "Files" button slightly larger.

**Claude:** Bumped from 12px to 13px.

### Draggable Panel Width

**Tom:** Is it hard to make the files panel width draggable when it's visible?

**Claude:** Not hard. Added a drag handle on the left edge of the file panel using mousedown/mousemove/mouseup events. Hover highlights in light indigo, dragging resizes between 200px and 800px minimum/maximum.

### Read-Only Labels

**Tom:** Can you rename the "Workspace" panel heading to "Workspace Files (read-only)" and add " (read-only)" after the filename in the section below it?

**Claude:** Updated both FileTree heading and FileViewer path display.

### Configurable Token Budget

**Tom:** Can you tell me what would be involved in making the context window size configurable from the UI? Right now it's hard-coded at 128,000 tokens. I want the user to be able to choose that. This is just for the % usage calculation, not a hard limit on the window. Maybe we should call it something like a limit or something else just so people don't think it's a hard-coded part of the model.

**Claude:** Outlined the approach. Suggested "token budget" as the name. For storage: could be UI-only (localStorage), per-session (DB), or global server setting. Since it's purely a display threshold, UI-only seemed right.

**Tom:** I'm fine if it's UI only. Except wait. I want the agent to be able to reason about this number as well. Does that mean it has to go into the server somehow?

**Claude:** Yes — the agent uses the context status endpoint to decide when to summarize/drop messages. If it only lives in the UI, the agent would still see the hardcoded 128k. So it needs to be server-side. Simplest path: mutable in-memory setting (initialized from env var), plus `GET/PUT /api/settings/token-budget`. The context endpoint uses the mutable value. Agent needs no changes since it already reads `maxTokens` from the context endpoint. Tradeoff: in-memory resets on server restart.

**Tom:** In-memory is fine for now.

**Claude:** Asked whether to implement now or note for later, since we're mid-file-panel work.

**Tom:** I'm not sure how to integrate this effort into our workflow. I want to keep the project's documentation well-organized. Should this be a new conversation with new notes and an ADR, or will it make sense to do the work here?

**Claude:** Recommended doing it here — it's small, closely related (both Phase 15 UI features), and `/conversation-notes` at the end will capture everything. A separate conversation would make sense for a larger feature requiring its own phased plan.

**Tom:** Yes, go ahead.

**Claude:** Implemented:
- `packages/server/src/settings.ts` — mutable `tokenBudget`, initialized from `LLM_MAX_TOKENS` env var
- `packages/server/src/routes/settings.ts` — `GET/PUT /api/settings/token-budget`
- Replaced all `LLM_MAX_TOKENS` references in `sessions.ts` and `context.ts` with `getTokenBudget()`
- UI API client functions `getTokenBudget()` and `setTokenBudget()`
- Editable budget display in the context gauge — dashed underline on the number, click to edit inline, Enter to save, Escape to cancel
- Gauge text renamed from "tokens" to "token budget"

### Debugging: Budget Edit Not Closing

**Tom:** The token budget opens when I click, it goes back when I press escape, but it doesn't close out and update when I change the number and hit enter.

**Claude:** Added `e.preventDefault()` to the Enter key handler. Still didn't work.

**Tom:** It's still not working. I've tried pressing enter and tabbing away to another element, but the text entry box stays there.

**Claude:** Rewrote the approach more robustly: `commitBudget` uses `setEditingBudget` with an updater function to prevent double-firing, reads value directly from the input ref to avoid stale closures. Separated `commitBudget` (Enter/blur) from `cancelBudget` (Escape). Also needed to add `useCallback` import.

**Tom:** I get an error: "onTokenBudgetChange is not defined"

**Claude:** The prop was declared in the type but not destructured in the function parameters. Added `onTokenBudgetChange` to the destructuring.

**Tom:** That works.

### Wrapping Up

**Tom:** I need to wrap development and start planning what to do in the demo I need to submit.

**Claude:** Created two commits: one for prior session's work (summarization, CLAUDE.md prepend), one for Phase 15 (filesystem viewer, workspace fix, token budget). Then ran conversation notes.
