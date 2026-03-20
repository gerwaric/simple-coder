# Sub-Phase Implementation Tracks
**Status:** Accepted
**Date:** 2026-03-20
**Source:** [Conversation 003](../conversations/003-coding-agent-implementation.md)

## Context

The coding agent plan (Phases 8–13) mixed tool/approval work and context management work within each phase. Phase 8 added both tool types and context types to the schema. Phase 9 added both approval endpoints and context endpoints. Phase 10 added both the tool loop and the context tool. This meant each phase was large, had mixed concerns, and couldn't be tested independently.

Context management is a key feature for the project sponsor. We needed a way to develop it incrementally with testable checkpoints, rather than having it arrive all-at-once entangled with tool execution.

## Decision

Split Phases 8–10 into two independent tracks:

- **Track (a): Tools and Approval** — 8a → 9a → 10a
- **Track (b): Context Management** — 8b → 9b → 10b

The tracks merge at Phase 11 (UI), which stays unified because tool rendering and context controls touch the same UI files.

```
8a → 9a → 10a → 11 → 12 → 13
8b → 9b → 10b ↗
```

Each sub-phase includes its own incremental integration tests rather than deferring all testing to Phase 13. Phase 13 then focuses on end-to-end integration tests and polish.

## Consequences

- Context management can be verified via direct DB queries and curl before the agent uses it
- The tool loop works end-to-end without context management, reducing debugging surface
- Test count grows incrementally (12 → 21 → 37 → 46 across 8a/8b/9a)
- Phase 13 scope narrows to e2e tests and polish rather than writing all tests from scratch
- Phase 11 edits UI files once instead of twice, avoiding incomplete intermediate states
- Six prompt files instead of three, but each is smaller and more focused
