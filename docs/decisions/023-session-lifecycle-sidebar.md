# Session Lifecycle Operations from Sidebar
**Status:** Accepted
**Date:** 2026-03-20
**Source:** [Conversation 005](../conversations/005-phase-13-testing-and-ui-polish.md)

## Context
Users needed a way to manage session lifecycle (stop, restart, delete, rename) directly from the session list sidebar, rather than only through the chat panel. Additionally, there was no way to restart stopped sessions or delete sessions entirely.

## Decision
Add four operations to each session item in the sidebar:
- **Rename** (✎ pencil icon, always visible): click to enter inline edit mode, Enter or checkmark to save, Escape to cancel
- **Stop** (■ red square): visible on active/pending sessions, stops the session
- **Restart** (▶ green play): visible on stopped/completed sessions, sets state back to pending and dispatches
- **Delete** (🗑 trash): always visible, requires confirmation dialog before permanent deletion

Server additions: `PATCH /api/sessions/:id` for rename, `POST /api/sessions/:id/restart` for restart, `DELETE /api/sessions/:id` for delete. Pending sessions accept new messages (enabling chat input after restart even before an agent picks up the session).

## Consequences
- Users can manage the full session lifecycle from one place without navigating away
- Restart enables recovering stopped sessions — the agent picks them up with full message history
- Delete is irreversible (hard delete with CASCADE) but requires confirmation to prevent accidents
- The `session:deleted` WebSocket message type was added to keep connected UI clients in sync
- Pending sessions now accept messages, which triggers dispatch — this means a user can type into a restarted session before an agent connects
