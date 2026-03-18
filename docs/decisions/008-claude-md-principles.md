# CLAUDE.md Principles
**Status:** Accepted
**Date:** 2026-03-18
**Source:** [Conversation 001](../conversations/001-initial-planning.md)

## Context

HumanLayer's blog post on writing a good CLAUDE.md emphasizes: structure around WHY/WHAT/HOW, keep it concise (under 60 lines), use progressive disclosure (point to docs rather than inline), only include universally applicable instructions, and never use LLMs as linters. Our initial CLAUDE.md was 47 lines with too much non-universal detail.

## Decision

Restructure CLAUDE.md to align with HumanLayer's principles:

- **WHY**: Assessment context front and center — design thinking over feature count
- **WHAT**: Monorepo structure, concise stack description
- **HOW**: Build, test, and run commands
- Progressive disclosure: point to `docs/implementation-plan.md` and `docs/decisions/` for details
- Move documentation conventions into the `/conversation-notes` skill (only relevant when that skill runs)
- Remove design principles discoverable from code
- Target: under 30 lines

## Consequences

- Every Claude Code session starts with focused, relevant context
- Documentation conventions don't dilute the universally-applicable instructions
- Reviewers see we've read and applied HumanLayer's own guidance — meta-alignment with the assessor
- CLAUDE.md must be maintained as the project evolves — commands may change
