# Code Audit and Remediation Planning
**Date:** 2026-03-21

## Decisions Made
- [ADR-026: Audit Remediation as Single Phase](../decisions/026-audit-remediation-phase.md)

## Discussion

### Full Code Review

**Tom:** Starting with the README, I want to perform a project review.

**Claude:** Launched four parallel exploration agents to review: (1) project structure, dependencies, documentation, Docker setup, and shared types; (2) all uncommitted changes; (3) server and agent code for security, error handling, race conditions, and protocol issues; (4) UI code for accessibility, state management, and robustness.

The review found issues across several categories:

**Critical:** Session dispatch race condition — two concurrent `dispatchPendingSessions()` calls can grab the same idle agent, losing a session. No authentication on HTTP API routes. Weak default agent secret. Agent disconnect race between in-memory and DB state.

**Medium:** No path validation on file tools (directory traversal possible). Silent JSON parse failures on WebSocket. Missing DB indexes on `messages.session_id` and `messages.tool_call_id`. Naive token estimation (`text.length / 4`). No approval timeout — `waitForApproval` promise leaks forever. No WebSocket heartbeat.

**UI:** No error boundaries. API errors only logged to console. Missing `useMemo` on `buildDisplayList()`. Accessibility gaps (no aria-labels). Fixed sidebar width.

**Uncommitted changes:** Work-in-progress adding markdown rendering via `react-markdown` for agent messages, plus a tool pairing refactor and agent session cleanup fix.

Recommended prioritized fix list: (1) dispatch race, (2) path validation, (3) env var validation, (4) DB indexes, (5) UI error boundary, (6) surface API errors, (7) approval timeout.

### Scoping and Planning Approach

**Tom:** In the spirit of how this project has been documented, let's create a plan to address these items one-by-one, and create the appropriate documentation/decisions/notes as we go. With this in mind, let's work back and forth on the open questions we should resolve before writing a plan.

**Claude:** Raised six open questions:

1. **Goal of this work?** (a) Demo/submission hardening, (b) production-ready, or (c) learning/portfolio polish — affects which issues are worth fixing.
2. **Uncommitted markdown changes?** Commit first as clean baseline, or fold in?
3. **Authentication scope?** ADR-006 says localhost trust model. Is adding API auth in scope?
4. **ADR policy?** Which fixes warrant ADRs vs. just commits?
5. **Phasing strategy?** Phase 14 with sub-phases, separate track, or single phase?
6. **Which items do you care about?** Drop, reorder, or add anything?

**Tom:** My goal is a mix of (a) and (c). If we later decide to make this a production-grade product, there will be more reviews and changes. Yes, please commit the react-markdown support before doing anything else. Check with the project definition — I don't want to over-engineer this demo, especially since it's about the agent, not the auth. Anything that is a material change to the system feels like it should be an ADR. I don't want anything to be lost, but I'm not sure what should be an ADR or "just" a code change that will be obvious to anyone auditing the system later. What do you think about how to label the phases? Seems like an interesting decision. Let's talk about it. If we can resolve all those items, I'm fine with the order you proposed.

### Authentication Scope

**Claude:** Checked ADR-006 and the project definition. ADR-006 explicitly says "skip UI authentication entirely — single-user localhost deployment doesn't warrant it." The implementation plan says the same: "UI auth is skipped (single-user localhost deployment)." So we drop the HTTP API auth item from the plan. The weak default secret issue is also downgraded — it's a dev convenience, not a production concern.

### Phase Labeling

**Claude:** Presented three options:

**(A) Phase 14 with sub-phases** — Continues linear numbering. Simple, but implies this is "the next step in building the system" when it's actually audit-driven fixes.

**(B) Separate track (e.g., "H1, H2, H3..." for hardening)** — Distinguishes the work by kind. Precedent exists for sub-tracks (8a/8b, 9a/9b). But "hardening" might overstate the scope.

**(C) Phase 14 as a single "audit remediation" phase, with items as tasks not sub-phases** — Treats the whole effort as one logical phase since it stems from one review. Individual items get commits, not their own phase numbers. Simpler, and honest about the scope. ADRs capture the decisions that aren't obvious from the code alone.

Recommended (C) because: items are mostly small and independent, they don't have dependency chains that justified sub-phases in 8-10, a single "Phase 14: Audit Remediation" captures the *why* (a code review happened) without overstating scope, and each fix gets its own commit as the real audit trail.

**Tom:** I also like C.

### ADR Boundaries

**Claude:** Proposed which of the 7 items warrant an ADR:

| # | Item | ADR? | Reasoning |
|---|------|------|-----------|
| 1 | Dispatch race condition | **Yes** — choosing a concurrency strategy is architectural | |
| 2 | Path validation on tools | **Yes** — defines sandbox boundary policy, relates to ADR-024 | |
| 3 | Env var validation at startup | No — fail-fast is standard practice, obvious from code | |
| 4 | DB indexes | No — straightforward, obvious from schema | |
| 5 | UI error boundary | No — standard React pattern | |
| 6 | Surface API errors to users | No — obvious from component changes | |
| 7 | Approval timeout | Maybe — policy decision (how long? what happens on timeout?) but could be a reasonable default | |

Noted being on the fence about #7: a 5-minute timeout with auto-reject is defensible, but if the timeout should be configurable or if the behavior on timeout matters (reject vs. cancel vs. re-prompt), that's worth an ADR.

**Tom:** Let's do an ADR for #7.

**Claude:** Got it. Three ADRs: dispatch race fix (026), path validation policy (027), and approval timeout policy (028).

### Committing Baseline

Claude committed the uncommitted changes as two separate commits:
1. `8127436` — "Add markdown rendering for agent messages" (react-markdown, markdown.css, MessageBubble, StreamingMessage)
2. `df50c94` — "Refactor tool pairing logic and fix agent session cleanup" (ChatPanel tool ID indexing, tilde prefixes, clearAgentSession on ready)

### Plan Creation

Claude wrote the Phase 14 prompt at `docs/prompts/015-phase-14-audit-remediation.md` with all 7 items, their problem/fix/files/verification details, and the 3 planned ADRs. Updated `docs/progress.md` (Phase 13 marked complete, Phase 14 added as in-progress) and `docs/prompts/README.md` (new Audit Remediation section).

### Documentation Timing

**Tom:** Should we call conversation-notes before we commit?

**Claude:** Yes — this conversation has design decisions (phase labeling, ADR boundaries, auth scoping) that should be captured.
