# Phase 13: Testing, UI Polish, and Hardening
**Date:** 2026-03-20

## Decisions Made
- [ADR-021: Context Bar UI for Message Management](../decisions/021-context-bar-ui.md)
- [ADR-022: Tool Call Pairing in UI](../decisions/022-tool-call-pairing.md)
- [ADR-023: Session Lifecycle Operations from Sidebar](../decisions/023-session-lifecycle-sidebar.md)
- [ADR-024: Agent Container Sandboxing](../decisions/024-agent-container-sandboxing.md)
- [ADR-025: Real Database IDs for Tool Messages](../decisions/025-real-ids-for-tool-messages.md)

## Discussion

### Phase 13 Planning and Gap Analysis

**Tom:** We are implementing a coding agent system. Read docs/progress.md to see where we are — Phase 13 (Testing + Polish) is the final phase. Read the phase prompt for the full specification. Please read the files, then stop to discuss your approach before implementing.

**Claude:** I read the progress file, phase prompt, diagnostic patterns, and coding agent plan. I assessed the current state: 60 tests across 7 files covering tool messages, agent WS, sessions, lifecycle, context management, context API, and tool approval. I compared the Phase 13 spec against existing tests and found most areas already well-covered, with a few gaps: write_file approval tests, follow-up re-dispatch, multiple sequential sessions, and turn:complete clearing agent assignment. I proposed a four-pass approach: read existing tests carefully, write new tests for genuine gaps, error handling polish, then README/docs updates.

**Tom:** Yes, that sounds good. I do want to make sure that this discussion is captured at the end of our session, but I agree that reading the test more carefully to revise the tests is a good idea. Do you have any questions for me on this?

**Claude:** No questions — the plan is clear and the spec is well-defined. I proceeded to read all test files in detail.

After reading all 7 test files and the setup infrastructure, I revised the gap analysis down to just 3 genuine test gaps (turn:complete, follow-up re-dispatch, multiple sequential sessions), 2 error handling fixes (approval resolver cleanup on session:stop, system prompt division-by-zero), and README/docs updates. The existing suite was more comprehensive than initially expected.

**Tom:** Should we update any plans or documents before we begin?

**Claude:** Two things worth doing: mark Phase 13 as "In Progress" in progress.md, and no new ADRs needed since the decisions here are tactical, not architectural. The scope is small enough that it doesn't need a separate plan document.

**Tom:** Yes, please.

### Implementation: Tests and Fixes

Claude implemented:
- 3 new lifecycle tests: turn:complete agent release, follow-up re-dispatch with full history, multiple sequential sessions
- Approval resolver fix: on session:stop, pending approval promises are now resolved with a rejection instead of just clearing the map
- System prompt division-by-zero guard for maxTokens === 0
- README updates reflecting coding agent capabilities, tools, approval flow, context management, 63 tests
- Implementation plan updates removing stale "placeholder" references

All 63 tests passed. Changes were committed as "Phase 13 — integration tests and polish for coding agent."

### Context Bar UI Design

**Tom:** The context settings for each message. Right now it's a small X in the upper right. I'd like a more discoverable and clean presentation. Work back and forth with me on this so we can come up with a better design.

**Claude:** I presented four options: (A) hover footer bar, (B) context status badge + toggle, (C) left-margin indicator bar, (D) swipe/slide pattern.

**Tom:** I like the left margin indicator.

**Claude:** I asked design questions: bar vs icon, placement for user messages, tooltip or label. I suggested a thin vertical bar (3-4px) on the left edge, green/blue for active, gray for dropped.

**Tom:** I like the thin vertical bar, as long as it's wide enough that it's a reasonable target for a human with a mouse or trackpad. Can we put this bar on the left of agent messages and right of system messages?

**Claude:** I clarified — did you mean left for agent messages and right for user messages? There aren't really visible "system" messages in the chat.

**Tom:** Yes. Sorry. Agent messages on the left, with the bar to the left of that. User messages on the right with the vertical bar to the right of them. Does that make more sense? Also, are there any blocks that should not have a bar beside them because they are not part of the context?

**Claude:** That makes perfect sense — bar always on the "outside" edge. On the second question: I suggested showing the bar only on user and assistant messages, leaving tool messages without a bar. Dropping a tool call without its result would create an incoherent context for the LLM. The summarize feature covers dropping tool exchanges better.

**Tom:** Yes.

Claude implemented: 6px wide bar, blue (#3b82f6) active, light gray (#d1d5db) inactive, removed the old × / + buttons.

**Tom:** Can you change the color from blue to green when the message is in context, and gray to orange when the message is out of context?

Claude changed to green (#22c55e) for active, orange (#f97316) for dropped.

### Tool Call Pairing

**Tom:** Now I want to think about tool calls. There are times when a tool will read a lot of text that later gets summarized, so it makes sense to be able to reject that from the context history. But if we do that, should we also remove the tool call itself? Basically I wonder if the vertical bar for tool calls should span the tool call as well as the result. Does that have some hidden downside?

**Claude:** Grouping makes UX sense — they're always a pair, and dropping one without the other would confuse the LLM. I identified hidden downsides: (1) server tracks context status per-message, so clicking one bar needs two API calls, (2) tool calls without results yet have no result to pair with, (3) multiple tool calls in a row each need their own bar. None are dealbreakers.

**Tom:** How about if the bar is grey and disabled before the tool call returns? And I agree each call+result pair should have its own bar.

**Claude:** That's clean. I implemented: new ToolPairBubble component that groups tool_call + tool_result by toolCallId, with a single context bar. Gray and disabled when pending, green/orange when complete. ChatPanel now builds display items with toolPair and toolPending types.

### Scroll Position Fix

**Tom:** After I click on the context toggle bar, the page scrolls down to the most recent chat. I'd like the scroll position to stay unchanged.

**Claude:** The useEffect in ChatPanel triggered scroll-to-bottom whenever messages changed, and the context status update caused a re-render. Fixed by tracking message count — only auto-scroll when new messages arrive or streaming is active, not when existing messages update.

### Session Renaming

**Tom:** Now can we make it possible to rename sessions? What are some classic simple ways to handle this?

**Claude:** I presented options: double-click to edit, pencil icon, click title in chat header. Leaned toward double-click in the sidebar for simplicity.

**Tom:** What visual clue would there be that session titles are editable?

**Claude:** Options: hover cursor change (cursor: text), pencil icon on hover, or both. Suggested cursor change for simplicity.

**Tom:** What about a clickable pencil icon to enable/disable editing (also hitting return while editing would end editing)?

**Claude:** That's clear and predictable. I asked: should the pencil always be visible, or only on hover?

**Tom:** Yes, let's have the pencil icon always visible.

Claude implemented: PATCH /api/sessions/:id endpoint, API client function, SessionList with pencil/checkmark edit flow, Enter to save, Escape to cancel, blur to save.

**Tom:** Can we have the edit box text default to the current session name?

**Claude:** It already does — sessions are created with empty titles, so the edit box correctly shows "" (empty). Added placeholder="Untitled" so the input shows light gray "Untitled" text when empty.

### Session Stop, Restart, and Delete

**Tom:** Now can we add a stop and trash can icon to each session in the side panel, so users can deactivate or delete sessions from the side panel?

**Claude:** I asked design questions about stop (which states?), delete (hard vs soft?), and confirmation. Suggested stop (■) on active/pending, delete (🗑) always visible with confirmation.

**Tom:** Can we restart inactive sessions in our model?

**Claude:** No, not currently. States are pending → active → stopped/completed with no path back. I proposed adding restart support: POST /api/sessions/:id/restart sets state to pending and dispatches. With restart: stop = pause (reversible), restart = resume (play ▶), delete = permanent.

**Tom:** Let's add stop, start, and delete. Delete should require a confirmation dialog. Active/pending sessions can show the stop icon, which switches to a play icon in place when the session is stopped.

Claude implemented: POST /api/sessions/:id/restart endpoint, DELETE /api/sessions/:id endpoint, session:deleted WS message type, SessionList with ■ (red stop), ▶ (green play), 🗑 (trash) icons, and a confirmation modal for delete.

**Tom:** Can you give those three buttons a square outline with rounded edges so they stand out visually?

Claude updated the icon button style with white background, light gray border, and 4px rounded corners.

### Context Gauge Relocation

**Tom:** Now can you move the context status bar so that it's just above the chat message entry textbox?

Claude moved the context gauge from the top of the chat panel to just above the input box, changing borderBottom to borderTop.

**Tom:** Can you add the number of messages in the context window to that status bar, and print the total number of (estimated) tokens in a format like 1,234,933 instead of using "k"?

Claude updated to show: "5 messages · 1,234 / 128,000 tokens (1%)" using toLocaleString() for comma formatting and filtering active messages for the count.

### Bug Fixes Found During Testing

**Tom:** This looks good. [Reports page goes blank when stopping a session]

**Claude:** Found the bug: line 148 in sessions.ts stop handler had `broadcastToUi({ type: "session:updated", updated })` — property was `updated` but the SessionUpdated type expects `session`. The UI received undefined for msg.session, corrupting the sessions list.

**Tom:** That's fixed. Now I see that when I restart a stopped session it changes to pending and stays there. The chat text edit says "Session is not active" and I cannot enter text or click "send."

**Claude:** Two issues: (1) the server's POST /:id/messages endpoint rejected non-active sessions, and (2) the UI's canSend check only allowed active state. Fixed both to accept pending sessions too, since a restarted session needs to accept follow-up messages that trigger dispatch.

**Tom:** After I stop and restart a session, the agent receives session:assign, then session:stop, then user:message, and turn:complete for null.

**Claude:** Race condition: session:stop (from the original stop) arrives at the agent between session:assign and user:message during restart. The stop handler clears currentSessionId, so the subsequent user:message runs with null. Fixed by adding guards: user:message ignores if no active session, and both session:assign and user:message only send turn:complete if currentSessionId is still set after the tool loop.

### Tool Message UUID Error

**Tom:** I saw an error when I clicked on the context bar for a tool call: "invalid input syntax for type uuid: 'a27d759e-...-result'"

**Claude:** Tool result messages in the UI used synthetic IDs like `${toolCallId}-result` instead of real database UUIDs. When the context bar tried to PATCH the context status, the server couldn't parse the synthetic ID as a UUID. Fixed by having the server include the real messageId in all tool-related broadcasts (tool:call, tool:result, tool:approval:request), and the UI uses those real IDs.

### Agent Container Sandboxing

**Tom:** Do all the agent sessions share the same workspace?

**Claude:** Yes — all agent containers mount the same workspace volume, and within a single agent, all sessions share /workspace. No per-session isolation.

**Tom:** That's good, because it allows the user to start new sessions for new coding topics. Is there any kind of sandbox preventing the agent from modifying files outside of the workspace?

**Claude:** No real sandboxing. The bash tool runs with cwd set to /workspace but nothing prevents commands outside it. The Docker container provides some isolation from the host, but within the container, the agent has full access. The approval flow is the main safety mechanism.

**Tom:** Are there other ways to sandbox the agent, e.g. via user/group permissions?

**Claude:** Several options: (1) non-root user with ownership only of /workspace, (2) read-only filesystem with allowlisted writable paths, (3) AppArmor/seccomp profiles, (4) capability dropping. Suggested the pragmatic combo of non-root user + read_only: true in docker-compose with tmpfs for /tmp.

**Tom:** With the changes you are proposing, will the workspace be writable and persist between sessions?

**Claude:** Yes. The workspace is a Docker volume mount, so read_only: true doesn't affect it — volumes are always writable. And volumes persist across container restarts.

**Tom:** Ok. Let's make sure the agent is a non-root user and make the read-only changes. Are there any open issues before we start?

**Claude:** Found the Dockerfile already had the non-root user setup from Phase 12. Only needed docker-compose.yml changes: read_only: true, tmpfs for /tmp, and named volumes for /workspace and /home/agent.

**Tom:** Can we mount /home/agent as a persistent writable folder somehow?

**Claude:** Yes — made it a named volume like workspace. Git config, ssh keys, shell history, npm cache all survive restarts.
