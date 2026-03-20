# Phase 13: Testing + Polish

Read `docs/coding-agent-plan.md` and `docs/progress.md` for full context.

## Task

Add integration tests for the new tool and context management features. Polish error handling. Update README and documentation.

## New Integration Tests

Extend the existing test suite (or add new test files) to cover:

### Tool Execution Tests
- Agent receives session, LLM produces a tool call → tool call message persisted correctly
- `read_file` tool call executes without approval, result persisted
- `bash` tool call triggers approval request, persisted with `approvalStatus: 'pending'`
- `write_file` tool call triggers approval request

### Approval Flow Tests
- Approve a pending tool call via `POST /api/tools/:callId/approve` → agent receives approval response
- Reject a pending tool call → agent receives rejection
- Respond to `ask_human` via `POST /api/tools/:callId/respond` → agent receives response text

### Context Management Tests
- Change message context status via `PATCH /api/messages/:id/context-status` → status updated in DB
- Drop a message (set to inactive) → verify `GET /api/sessions/:id/context` reflects the change
- Create a summary → messages set to 'summarized', summary created in DB
- Verify summary constraint: cannot summarize a message that's already summarized (Rule 2)
- Verify overlap constraint: cannot add a message to two summaries (Rule 1)
- Restore from summary → messages back to active, summary deleted

### Session Lifecycle Tests
- Agent completes a turn (no tool calls) → sends `turn:complete` → server clears agent assignment
- New session created after agent released → agent picks it up via dispatch
- Follow-up message sent to a session whose agent was released → session re-dispatched, agent receives full history
- Multiple sequential sessions served by a single agent without restart

### Token Counting Tests
- Verify `estimateTokens` returns reasonable values
- Verify token counts are populated when messages are persisted

## Error Handling Polish

- Tool executor: wrap all tool executions in try/catch, return error as tool result
- Approval timeout: if the agent is waiting for approval and the session is stopped, clean up the pending promise
- Context tool: handle HTTP errors from server API gracefully
- System prompt builder: handle edge cases (no repos cloned, zero tokens used)

## README Updates

Update `README.md` to reflect the coding agent capabilities:
- Update architecture description to mention tools and approval flow
- Update the "Design Decisions" section with references to new ADRs
- Update the "Quick Start" section if any setup steps changed
- Add a section on the tool set and approval model
- Update the testing section with new test count
- Update the extensibility section

## Documentation Updates

- Update `docs/implementation-plan.md` to reference the coding-agent-plan.md for phases 8+
- Ensure all cross-references between docs are correct

## Verification

1. `pnpm test` — all tests pass (existing + new)
2. `docker compose up --build` — end-to-end works
3. README accurately describes the current system
4. A reviewer can follow the README to get the system running

## On Completion

Update `docs/progress.md`. Commit with message: "Phase 13 — integration tests and polish for coding agent"
