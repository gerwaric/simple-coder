# Tool Call Pairing in UI
**Status:** Accepted
**Date:** 2026-03-20
**Source:** [Conversation 005](../conversations/005-phase-13-testing-and-ui-polish.md)

## Context
Tool calls and their results are stored as separate messages in the database, but they are semantically a pair. Dropping a tool call without its result (or vice versa) would create an incoherent context for the LLM. We needed a way to manage tool message context as a unit.

## Decision
Group adjacent tool_call and tool_result messages by their shared toolCallId into a single visual unit (ToolPairBubble) with one context bar spanning both. The bar has three states: green (active, clickable), orange (dropped, clickable), and gray (pending — result hasn't arrived yet, disabled). Clicking the bar sets context status on both messages. Each tool call+result pair gets its own bar, even when multiple tool calls occur in sequence.

## Consequences
- Users cannot accidentally create orphaned tool calls or results in the context
- The gray/disabled state for pending tool calls prevents premature context manipulation
- Two API calls are made per toggle (one per message), with a small risk of partial failure — recoverable by clicking again
- The ChatPanel display list builder now groups messages by toolCallId, adding complexity to the rendering pipeline
- Summaries remain the better mechanism for bulk context management of tool exchanges
