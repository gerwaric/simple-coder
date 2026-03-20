# Bug Documentation Strategy
**Status:** Accepted
**Date:** 2026-03-20
**Source:** [Conversation 004](../conversations/004-debugging-ui-and-agent-lifecycle.md)

## Context

During the first debugging session, we needed to decide how to document bugs and the fixes they produce. Options considered were: a dedicated `docs/bugs/` folder with per-bug files, a single bug log, commit messages only, or a hybrid approach. The project already has ADRs for design decisions and conversation notes for session records.

## Decision

Bugs are documented based on their impact:

- **Bug requires a design/protocol change** — create an ADR. The bug is the Context section that motivates the decision. No separate bug document needed.
- **Bug is an implementation fix** — the commit message is the documentation. It must capture the root cause, not just the symptom.
- **Diagnostic patterns** — non-obvious, system-specific debugging knowledge goes in `docs/diagnostic-patterns.md` for future reference.
- **Session record** — debugging sessions use `/bugfix-wrapup` (a project slash command) to generate conversation notes with a diagnostic-focused format.

No `docs/bugs/` folder. No separate bug tracking system.

## Consequences

- ADRs serve double duty: design documentation and bug-motivated-change records
- Commit discipline matters more — implementation fix commit messages must explain root cause
- `docs/diagnostic-patterns.md` accumulates system-specific debugging knowledge over time
- The `/bugfix-wrapup` command standardizes how debugging sessions are documented
