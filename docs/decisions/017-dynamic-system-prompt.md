# Dynamic System Prompt
**Status:** Accepted
**Date:** 2026-03-19
**Source:** [Conversation 002](../conversations/002-coding-agent-design.md)

## Context

The current system prompt is a hardcoded string: "You are a helpful coding assistant." With tools, context management, and a workspace, the agent needs richer guidance that changes per-call based on state.

Tool schemas are passed via the Vercel AI SDK's `tools` parameter (handled by the API), so the system prompt focuses on behavior rather than tool definitions.

## Decision

The system prompt is assembled fresh before each LLM call with this structure:

```
[Role and behavioral guidance — top]
  - What you are and what you can do
  - When to ask the human vs act independently
  - How to manage context

[Dynamic state — middle]
  - Working directory and cloned repos
  - Context budget (used / total tokens, percentage)
  - Context warning if above 70%

[Behavioral reinforcement — bottom]
  Reminders:
  - Use ask_human when uncertain — don't guess
  - Mutating actions require approval
  - When context exceeds 70%, summarize or drop old messages
  - Keep the user informed of what you're doing and why
```

The behavioral guidance is duplicated at top and bottom to address the "lost in the middle" problem — LLMs attend more strongly to the beginning and end of context.

Workspace state is kept minimal: just cwd and what repos are cloned. The agent can explore further via tools.

The reinforcement section is a short static list for now.

## Consequences

- The system prompt requires a builder function, not a constant string
- Token counting must happen before the LLM call (to inject budget into the prompt)
- The agent needs to track workspace state locally (cwd, cloned repos) across tool executions
- The prompt grows slightly with each dynamic field, but the static portions are small
- Behavioral reinforcement at the end is a low-cost improvement to adherence
