# Coding Agent Implementation Planning
**Date:** 2026-03-20

## Decisions Made
- [ADR-018: Sub-Phase Implementation Tracks](../decisions/018-sub-phase-tracks.md)

## Discussion

### Pre-Implementation Review

**Tom:** Please read README.md, docs/project-definition.md, and docs/progress.md because we are about to implement the coding agent phases. I want to work back and forth with me on any questions you have before you begin. What do you think?

**Claude:** Reviewed all three files. Phases 0–7 are done — the core infrastructure works. Phases 8–13 are next — turning the conversational LLM into an actual coding agent with tool use. Read the planned prompts and ADRs for phases 8–13 and then raised six questions:

1. Has the codebase changed since the plan was written?
2. Should we stick with the current phase ordering (8→13)?
3. The plan has `read_file` and `context` as auto-execute, `bash`/`write_file` as approval-required. All bash goes through the same tool. Comfortable with that?
4. Context management is the most complex part. Full implementation as planned, or simpler first pass?
5. Which LLM provider/model should we target?
6. Integration tests incrementally or batched at Phase 13?

### Answers and Discussion

**Tom:**
1. The codebase should not have changed.
2. Yes, stick with the current order.
3. Lets require approval for all bash commands for now.
4. I want the context management, because the project sponsor is big on the concept and claims to have invented the term. However, I want to make sure we are developing stepwise and incrementally in testable steps. How is this broken out right now?
5. I want to be LLM-agnostic as much as possible. In testing of the previous phases this worked well (anthropic and openai both worked). Will this be true with the work we are about to do?
6. What do you think about adding integration tests incrementally vs batching them at the end?

**Claude:** On bash approval — simple change, we just remove `bash` from any safe list. The `assessToolCall()` function already handles this cleanly.

On context management breakdown — currently it's spread across three phases simultaneously. Phase 8 adds the schema, Phase 9 adds six REST endpoints, Phase 10 adds the context tool and dynamic system prompt. That's a lot landing at once in each phase alongside the tool/approval work. Proposed sub-dividing within each phase:

- **Phase 8a**: Core tool types only (tool_call/tool_result roles, toolName, toolArgs, toolCallId, approvalStatus). Skip contextStatus, tokenCount, summaries.
- **Phase 8b**: Context management types (contextStatus, tokenCount, Summary type, summaries table, context query functions).
- **Phase 9a**: Tool approval endpoints + WebSocket handling for tool:call, tool:approval:request, tool:result.
- **Phase 9b**: Context management endpoints (PATCH context-status, POST summaries, DELETE summaries, GET context).
- **Phase 10a**: Agent tool loop with bash/read_file/write_file/ask_human + approval flow. No context tool yet.
- **Phase 10b**: Add the context tool, dynamic system prompt with token budget, context WS message handlers.

Each sub-phase is independently buildable and testable. The tool loop works without context management, and context management can be verified via curl before the agent uses it.

On LLM agnosticism — the Vercel AI SDK abstracts the provider, so tool definitions and `streamText` calls are provider-agnostic. One caveat: thinking tokens are Anthropic-specific. For non-Anthropic models, those chunks simply won't appear — no breakage, just no thinking display.

On incremental vs batched tests — recommended incremental. Each sub-phase has a natural test surface, bugs found early are cheaper, it matches the "testable steps" principle, and Phase 13 can focus on end-to-end integration tests rather than writing all tests from scratch.

### Sub-Phasing Decision

**Tom:** I like the a/b subphasing as well as the testing. Please update the docs, then stop for questions.

**Claude:** Created six new prompt files (009a through 011b), updated progress.md with the sub-phased table and dependency graph, and updated the build sequence in coding-agent-plan.md. Key points:
- Dependency graph: `8a → 9a → 10a → 11 → 12 → 13` and `8b → 9b → 10b → 11`
- Each sub-phase includes incremental integration tests
- All bash commands require approval (reflected in safety check)

Also asked about Phase 11 — should it be split into 11a (tool rendering + approval UI) and 11b (context gauge + drop/restore controls)?

### Phase 11 Discussion

**Tom:** How do you recommend making this decision?

**Claude:** The question is whether the split buys you anything. The reason to split 8–10 was clear — tool work and context work are independent tracks with no code overlap. Phase 11 is different — the UI components for tools and context both touch the same files: the message list renderer, the WebSocket hook, the API helpers module, and the session state. Splitting would mean editing those files twice, and the "tool rendering" half would ship an incomplete message list that ignores context status. Recommendation: don't split Phase 11.

**Tom:** Keep phase 11 unified, and start your audit.

### Codebase Audit

**Claude:** Audited all files that will be modified in phases 8–13. Everything lines up with the plan. Two notable findings:

1. `ToolResult` is in the wrong union type — currently in `ServerToAgent` but needs to move to `AgentToServer`.
2. The LLM client maps messages simply (only role and content). Phase 10a needs a richer translation that handles tool_call/tool_result roles — the trickiest part of implementation.

No blockers found.

### Implementation

Proceeded with implementation of Phases 8a, 8b, and 9a. Each phase followed the pattern: modify types → update schema → update queries → build → run existing tests → add new tests → verify all pass.

Notable implementation detail: discovered that the test setup needed to drop and recreate tables (not just `CREATE TABLE IF NOT EXISTS`) to handle schema evolution cleanly. Updated test setup accordingly.

Test progression:
- Phase 8a: 12 existing + 9 new = 21 tests
- Phase 8b: 21 existing + 16 new = 37 tests
- Phase 9a: 37 existing + 9 new = 46 tests
