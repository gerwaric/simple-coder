# Demo Plan

## Context Management Demo

Demonstrates both agent-driven and user-driven context management in a single session.

### Setup

Start in media res: a session where the agent has already analyzed a crypto library, filling the context window with tool calls and detailed analysis. The context gauge should show the window is near capacity.

### Flow

**Step 0 — Establish the problem.**
Show the full crypto analysis conversation. Point out the context gauge is nearly full — this is a real constraint, not a contrived one.

**Step 1 — Agent summarizes automatically.**
Ask the agent to summarize the conversation to free up space. It creates a summary that replaces the detailed messages with a concise recap. Context usage drops significantly.

**Step 2 — User context management (3+7 trick).**
Ask the agent "what is 3 + 7?" (without showing work). It answers 10. Then manually drop the question from the context window. Ask "where did the 10 come from?" — the agent doesn't know. Restore the question — the agent figures it out. Simple, memorable proof that context management actually works.

**Step 3 — Restore and remove the summary.**
Restore the original crypto messages and delete the summary. This shows context management is non-destructive (nothing was lost), and re-exposes the individual tool call messages.

**Step 4 — Agent selectively hides tool calls.**
Ask the agent to manage its own context. It identifies tool call/result pairs as low-value and drops them selectively, keeping the substantive analysis. This demonstrates the agent making smart semantic choices about what to keep vs. drop — more sophisticated than bulk summarization.

### Key Points

- Context management works in both directions: agent-driven and user-driven
- Nothing is permanently lost — messages can always be restored
- The agent understands the semantic value of different message types
- This is a real constraint (token limits), not a demo gimmick
