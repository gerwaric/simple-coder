# Documentation Workflow
**Status:** Accepted
**Date:** 2026-03-18
**Source:** [Conversation 001](../conversations/001-initial-planning.md)

## Context

Tom wants planning conversations documented in the git history, not just the conclusions. Standard ADRs capture decisions well but flatten the exploratory reasoning that led to them. The documentation needs to stay organized across multiple planning sessions over the project's lifetime.

## Decision

A hybrid approach with a single command (`/conversation-notes`) that generates both:

1. **Conversation notes** (`docs/conversations/NNN-slug.md`) — near-verbatim records of planning discussions. Preserve the actual back-and-forth dialogue, questions as asked, dead ends, reversals. Minimal editorial intervention. The ADRs do the summarizing.

2. **Architecture Decision Records** (`docs/decisions/NNN-slug.md`) — standard ADR format (Context, Decision, Consequences) for each settled decision. Only final decisions get ADRs — if we change our mind during a conversation, only the conclusion is recorded as an ADR while the full deliberation lives in the conversation note.

Cross-linking: each conversation note lists its ADRs; each ADR links back to its source conversation.

## Consequences

- Single command produces both artifacts — low friction to maintain
- Conversation notes preserve design reasoning that ADRs would lose
- Bidirectional traceability between decisions and the discussions that produced them
- The conversation notes will be long files (near-verbatim dialogue), which is intentional
- Reviewers can choose their depth: ADRs for quick reference, conversations for full context
