Review the full conversation history from this session. Generate two types of documentation:

## 1. Conversation Note

Create `docs/conversations/NNN-<slug>.md` where NNN is the next available number (check existing files).

The conversation note should be a **near-verbatim record** of the discussion, not a summary. Format:

```markdown
# <Session Title>
**Date:** <today's date>

## Decisions Made
- [ADR-NNN: Title](../decisions/NNN-slug.md)
- ...

## Discussion

### <Topic>

**Tom:** <question or statement, close to verbatim>

**Claude:** <response, close to verbatim — preserve reasoning, not just conclusions>

**Tom:** <follow-up>

**Claude:** <response>

### <Next Topic>
...
```

Guidelines for conversation notes:
- Reproduce exchanges close to verbatim — do not compress into bullet points
- Keep questions as asked and answers as given
- Preserve dead ends, reversals, and exploratory tangents
- Only add minimal structural markup (topic headers for transitions)
- The ADRs do the summarizing — the conversation note is the raw record

## 2. Architecture Decision Records

For each **settled decision** identified in the conversation, create `docs/decisions/NNN-<slug>.md`:

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

## 3. Update Indexes

Update `docs/decisions/README.md` and `docs/conversations/README.md` with the new entries.

## Important

- Check existing files to determine the next available number for both conversations and decisions
- Ensure all cross-links between conversations and ADRs are correct
- Do not duplicate existing ADRs — check what already exists first
