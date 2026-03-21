# Context Bar UI for Message Management
**Status:** Accepted
**Date:** 2026-03-20
**Source:** [Conversation 005](../conversations/005-phase-13-testing-and-ui-polish.md)

## Context
The original context management UI used a small × button in the upper-right corner of each message bubble to drop messages from context. This was difficult to discover and easy to miss. We needed a more visible, intuitive control for managing which messages are in the active context window.

## Decision
Replace the × / + buttons with a thin vertical bar (6px wide) on the outside edge of each message bubble. The bar appears on the left of agent/assistant messages and on the right of user messages, following the natural alignment of the chat layout. Colors: green (#22c55e) when active, orange (#f97316) when dropped. Clicking the bar toggles the message's context status. Tool messages (tool_call, tool_result) are handled separately via paired bars (see ADR-022). The streaming message (in-progress) has no bar since it's not yet persisted.

## Consequences
- Context status is visible at a glance without hovering or inspecting individual messages
- The bar is wide enough (6px) to be a comfortable click target for mouse/trackpad users
- Color coding (green = in context, orange = out) provides immediate visual feedback
- The outside-edge placement keeps the bar from interfering with message content
- No bar on tool messages prevents users from creating incoherent context (orphaned tool calls or results)
