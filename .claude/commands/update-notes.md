Review the full conversation history from this session. This is a continuation of an existing planning session. Update the existing documentation rather than creating new files.

## 1. Find and Update the Conversation Note

Find the most recent conversation note in `docs/conversations/` (highest numbered file). Read it to understand what's already documented.

**Append** new discussion topics to the end of the existing file, following the same format:

```markdown
### <Topic>

**Tom:** <question or statement, close to verbatim>

**Claude:** <response, close to verbatim — preserve reasoning, not just conclusions>
```

Guidelines:
- Only add topics that are NOT already in the file
- Reproduce exchanges close to verbatim — do not compress into bullet points
- Preserve dead ends, reversals, and exploratory tangents
- Match the style and formatting of the existing content

## 2. Create New ADRs (if any)

Read all existing ADRs in `docs/decisions/` to determine what's already documented.

For each **new settled decision** in this session that does NOT already have an ADR:
- Create `docs/decisions/NNN-<slug>.md` using the next available number
- Use the standard template:

```markdown
# <Title>
**Status:** Accepted
**Date:** <today's date>
**Source:** [Conversation NNN](../conversations/NNN-slug.md)

## Context
What prompted this decision.

## Decision
What we decided.

## Consequences
What follows — both good and trade-offs.
```

## 3. Update the Conversation Note's Decisions List

Add links to any new ADRs in the "Decisions Made" section at the top of the conversation note.

## 4. Update Indexes

Update `docs/decisions/README.md` and `docs/conversations/README.md` if new entries were added.

## Important

- Do NOT create a new conversation note — append to the existing one
- Do NOT duplicate existing ADRs — check what already exists first
- Do NOT modify existing ADR content — only create new ones
- If no new decisions were settled, skip ADR creation entirely
