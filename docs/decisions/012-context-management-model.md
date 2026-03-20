# Context Management Model
**Status:** Accepted
**Date:** 2026-03-19
**Source:** [Conversation 002](../conversations/002-coding-agent-design.md)

## Context

Coding agents burn through LLM context fast — file contents, command output, search results. The existing agent sends the full, unbounded message history to every LLM call. We needed a way for both the agent and user to view and manipulate what's in context.

We considered scratch pads, auto-compaction, retrieval/RAG, repo maps, and other approaches used by existing coding agents. We chose to keep it simple: context management through message status, with no separate key-value store.

## Decision

**Three-state messages.** Every message has a `contextStatus` field:
- `active` — included in LLM calls (default)
- `summarized` — replaced by a summary in LLM calls, original preserved in DB
- `inactive` — excluded from LLM calls, still visible in UI

**Summaries as a separate entity.** A `summaries` table with a `summary_messages` join table, since one summary can replace multiple messages. Each summary has content, token count, created_by (agent or user), and created_at.

**No overlapping or nested summaries.** Enforced by two rules: (1) a message can only belong to one summary (unique constraint on message_id in join table), (2) only `active` messages can be summarized. To re-summarize, first restore the originals, then create a new summary.

**Non-destructive model.** Nothing is ever lost. The database keeps all original content. Dropping or summarizing only changes what the LLM sees. Users can restore any message to active. Like undo history — you choose which version to show.

**Both sides can manipulate context.** The agent uses the `context` tool (via HTTP to server API). The user uses UI controls (also via HTTP to the same API endpoints). The server broadcasts changes so both sides stay in sync.

**User controls are limited to drop/restore.** User-initiated summarization is deferred — if the user wants something summarized, they can ask the agent via chat. The agent has full context tool access including summarize.

**Token counting and budget in system prompt.** The agent is told its context usage before each LLM call. A context warning is injected when usage exceeds 70%.

## Consequences

- Database migration adds `contextStatus` and `tokenCount` to messages, plus `summaries` and `summary_messages` tables
- Context assembly filters messages by status before each LLM call
- The UI shows all messages including inactive/summarized ones, with visual distinction
- A text-only context gauge shows token usage
- No scratch pad, no auto-compaction, no retrieval pipeline — keeps implementation simple
- Token counting can use rough estimation (characters/4) rather than provider-specific tokenizers
