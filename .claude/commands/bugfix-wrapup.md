Review the full conversation history from this debugging/bugfixing session. Generate documentation that captures the diagnostic work, architectural decisions, and lessons learned.

## 1. Classify Each Bug

For each bug fixed in this session, classify it:

- **Architecture change** — the fix changed the protocol, data model, or system design → needs an ADR
- **Implementation fix** — the fix corrected an implementation mistake without design changes → commit message is sufficient (verify the commit message captures the root cause)

List each bug with its classification and rationale.

## 2. Create ADRs for Architecture Changes

For each bug classified as an architecture change, create `docs/decisions/NNN-<slug>.md`:

```markdown
# <Title>
**Status:** Accepted
**Date:** <today's date>
**Source:** [Conversation NNN](../conversations/NNN-slug.md)

## Context
What bug or failure prompted this decision. Include the symptom, the root cause diagnosis, and why the existing design was insufficient.

## Decision
What we changed and why this approach was chosen over alternatives considered.

## Consequences
What follows — both the fix and any new constraints or behaviors introduced.
```

## 3. Create Conversation Note

Create `docs/conversations/NNN-<slug>.md` where NNN is the next available number.

For debugging sessions, the conversation note should emphasize the **diagnostic journey**:

```markdown
# <Session Title>
**Date:** <today's date>
**Type:** Debugging / Bugfixing

## Bugs Fixed
- [Brief description] — [implementation fix | ADR-NNN]
- ...

## Decisions Made
- [ADR-NNN: Title](../decisions/NNN-slug.md) (only if any)

## Diagnostic Notes

### <Bug or Issue>

**Symptom:** What was observed

**Diagnosis:** How we identified the root cause — include what was tried, what was ruled out, and what led to the answer

**Root Cause:** The actual underlying issue

**Fix:** What was changed

### <Next Bug>
...

## Discussion

### <Topic>

**Tom:** <close to verbatim>

**Claude:** <close to verbatim>

...
```

## 4. Update Diagnostic Patterns

Check if `docs/diagnostic-patterns.md` exists. If not, create it. Append any new diagnostic patterns discovered during this session:

```markdown
## <Pattern Name>
**Symptom:** What you observe
**Check:** What to investigate
**Root Cause:** What's likely happening
**Learned:** <date>
```

Only add patterns that are non-obvious and specific to this system — things that would save time if encountered again. Do not add generic debugging advice.

## 5. Update Indexes

Update `docs/decisions/README.md` and `docs/conversations/README.md` with any new entries.

## Important

- Check existing files to determine next available numbers for conversations and decisions
- Ensure all cross-links between conversations and ADRs are correct
- Do not duplicate existing ADRs — check what already exists first
- Verify commit messages for implementation-only fixes adequately capture the root cause
