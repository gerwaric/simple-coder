# Audit Remediation as Single Phase
**Status:** Accepted
**Date:** 2026-03-21
**Source:** [Conversation 006](../conversations/006-code-audit-and-remediation-planning.md)

## Context

A comprehensive code review identified issues across concurrency, safety, validation, performance, and UI robustness. We needed to decide how to organize the remediation work within the existing phase structure (Phases 0-13). The issues are mostly small and independent — unlike the coding agent phases (8-12) which had dependency chains requiring sub-phase tracks.

Three options were considered:
- **(A)** Phase 14 with sub-phases (like 8a/8b) — overstates complexity
- **(B)** Separate labeling track (H1, H2... for hardening) — overstates scope for a demo
- **(C)** Single phase with individual commits — matches the actual scope

## Decision

Organize all audit remediation as **Phase 14: Audit Remediation** — a single phase where each fix gets its own commit. Items requiring architectural decisions get ADRs (026-028); straightforward fixes are captured by their commit messages alone.

The ADR boundary rule: if a fix involves choosing between alternatives with meaningful trade-offs (concurrency strategy, sandbox policy, timeout behavior), it gets an ADR. If the fix is standard practice that would be obvious to anyone reading the code (indexes, error boundaries, env validation), a commit is sufficient.

Authentication hardening is explicitly out of scope per ADR-006 — the localhost trust model is an intentional design choice for this demo, not a gap.

## Consequences

- Phase numbering continues linearly (14), maintaining the project's chronological narrative
- The phase prompt documents *what* the review found and *why* each item matters — the audit trail lives in the prompt, not scattered across sub-phase documents
- Three ADRs (dispatch concurrency, path validation, approval timeout) capture the non-obvious decisions
- Four items (env validation, indexes, error boundary, API errors) are captured by commits alone
- Future reviews can follow the same pattern: single phase, individual commits, ADRs only where decisions aren't self-evident
