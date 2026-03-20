# WebSocket Protocol Extension
**Status:** Accepted
**Date:** 2026-03-19
**Source:** [Conversation 002](../conversations/002-coding-agent-design.md)
**Supersedes:** [ADR-004: Protocol Extensibility](004-protocol-extensibility.md) (extends, does not replace)

## Context

The existing protocol defines `tool:call` and `tool:result` as placeholder types. With the approval flow, ask_human, and context management, we need additional message types. We considered extending existing types with optional fields vs creating new explicit types.

The assessment values design thinking. The type system documents the protocol — a reviewer reading the type definitions should understand every interaction the system supports.

## Decision

**New explicit message types** rather than overloading existing ones. Semantically distinct operations get distinct types.

New Agent → Server messages:
- `tool:approval:request` — agent sends a tool call that needs human approval (tool name, args, tool call ID)

New Server → Agent messages:
- `tool:approval:response` — approved or rejected (tool call ID, approved boolean, response text for ask_human)
- `context:updated` — user changed context status from UI (message IDs, new status)

New Server → UI messages:
- `tool:approval:request` — relay for UI to render approve/reject or ask_human input
- `context:updated` — message status changed, UI updates display
- `context:status` — token counts for the context gauge

**UI WebSocket stays one-directional** (server → UI broadcast). User actions (approvals, context changes) go through HTTP REST endpoints:
- `POST /api/tools/:callId/approve`
- `POST /api/tools/:callId/reject`
- `POST /api/tools/:callId/respond` (for ask_human)
- `PATCH /api/messages/:id/context-status`

This maintains the existing pattern: REST API is the write path, WebSocket is the read path.

## Consequences

- The type definitions in `ws-messages.ts` fully document the protocol
- Each interaction has its own type — no ambiguous optional fields
- Extensible: new operations get new types without touching existing ones
- The UI needs new HTTP calls for approval and context management
- The server needs new REST endpoints and WebSocket broadcast handlers
