# User-Initiated Summarization
**Status:** Accepted
**Date:** 2026-03-22
**Source:** [Conversation 007](../conversations/007-humanlayer-research-and-context-features.md)

## Context

The context management system (ADR-012) already supports agent-initiated summarization — the agent detects context pressure via the dynamic system prompt and creates summaries by calling the `context` tool. However, the user had no way to create summaries from the UI. Only drop (inactive) and restore were available to the user.

This was identified as a gap during research into HumanLayer's philosophy: Dex Horthy's 12-Factor Agents framework emphasizes "Contact Humans with Tool Calls" (Factor 7) and human oversight at high-leverage points. Context management is a high-leverage decision — the human may have better judgment about which messages to compress and what information matters.

## Decision

Add user-initiated summarization to the UI. The user clicks "Manually select & summarize message(s)" in the context gauge bar, selects active messages by clicking their context bars, writes a summary, and saves. This calls the existing `POST /api/sessions/:id/summaries` endpoint with `createdBy: "user"`.

The backend already supported `createdBy: "user"` — this was a UI-only change (ChatPanel.tsx, MessageBubble.tsx, api.ts). No server, database, agent, or shared type changes were needed.

We chose user-written summaries over LLM-generated summaries deliberately: the human decides what matters, which aligns with HumanLayer's thesis that humans handle judgment while agents handle volume.

## Consequences

- Users can now manage context proactively, not just reactively (drop/restore)
- Both the agent and user can create summaries, giving shared control over context
- The selection mode reuses the existing context bar UI (ADR-021), changing bar color to blue for selected messages
- Summary cards in the UI show `createdBy` implicitly through the existing display — no visual distinction was added between agent and user summaries
- The existing WebSocket broadcast (`summary:created`) handles real-time UI updates with no additional plumbing
