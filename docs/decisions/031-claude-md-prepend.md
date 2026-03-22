# CLAUDE.md Prepend to Context
**Status:** Accepted
**Date:** 2026-03-22
**Source:** [Conversation 007](../conversations/007-humanlayer-research-and-context-features.md)

## Context

The agent's system prompt (ADR-017) is dynamically generated with context usage stats, but has no mechanism for project-specific instructions. CLAUDE.md files are a convention (documented in ADR-008) for giving coding agents project-specific guidance — build commands, code style, architecture pointers. Including this in the agent's system prompt would make the agent more effective on projects that use this convention.

The setting needs to be per-session (different sessions may target different projects) and must survive agent reconnects (stored in the database, not transient).

## Decision

Add a per-session `includeClaudeMd` boolean flag. When set, the agent reads `/workspace/CLAUDE.md` on session assignment and prepends its contents to the system prompt, before the standard agent instructions. The flag is stored on the session in Postgres and flows through the existing `session:assign` WebSocket message.

The UI exposes this as a checkbox in the session sidebar: "Prepend CLAUDE.md to context if present". The checkbox state is captured at session creation time.

This required a full-stack change: shared types, DB schema, queries, API route, agent system prompt, agent connection handler, and UI components.

## Consequences

- The agent can now receive project-specific instructions without the user having to paste them into chat
- The flag persists on the session, so agent reconnects reload the same CLAUDE.md content
- If CLAUDE.md doesn't exist in the workspace, the agent logs a message and continues without it — no error
- The CLAUDE.md content is read once at session assignment, not on every tool loop iteration, keeping it efficient
- Future enhancement: could extend to other convention files (AGENTS.md, .cursorrules, etc.)
- The checkbox state is a UI-level preference, not stored in the database as a user setting — it resets on page reload (acceptable for MVP)
