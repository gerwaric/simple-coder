# Approval Flow Design
**Status:** Accepted
**Date:** 2026-03-19
**Source:** [Conversation 002](../conversations/002-coding-agent-design.md)

## Context

HumanLayer's product is about human oversight of AI agent actions. The tool architecture needs a natural approval boundary. We considered several models: approve every tool call, tiered trust, plan-then-execute gates.

## Decision

**Observe vs mutate boundary.** Tools are classified as safe (observe) or consequential (mutate):
- Safe: `read_file`, `context`, `ask_human` — execute immediately
- Consequential: `bash`, `write_file` — require user approval before execution

**Placeholder safety check.** A function `assessToolCall(tool, args)` returns `{ allowed: boolean }`. Current implementation:
```typescript
const safeTools = ['read_file', 'context', 'ask_human'];
return { allowed: safeTools.includes(tool) };
```

This is a seam for future logic (e.g., classifying safe vs dangerous bash commands) without architectural changes.

**Approval mechanics.** When a tool call needs approval:
1. Agent sends `tool:approval:request` to server
2. Server persists tool call message with `approvalStatus: 'pending'`
3. Server broadcasts to UI
4. UI renders approve/reject buttons
5. User responds via HTTP endpoint (`POST /api/tools/:callId/approve` or `/reject`)
6. Server sends `tool:approval:response` to agent
7. Agent executes (if approved) or tells LLM it was rejected

**ask_human follows the same pattern.** The agent sends a tool call, the loop pauses, the human responds. The difference is only in UI rendering — a text input instead of approve/reject buttons.

**Errors on tool failure become tool results.** No special error handling — the LLM sees the error and adjusts.

## Consequences

- The reviewer sees approval working in the demo (bash and write_file trigger it)
- The safety check is trivially extensible
- Approval and ask_human share the same pause/wait/resume mechanism
- The UI needs to render two interaction patterns: approve/reject and text input
- All bash commands currently require approval — future refinement could classify safe vs dangerous commands
