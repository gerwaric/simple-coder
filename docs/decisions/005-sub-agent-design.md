# Sub-Agent Design
**Status:** Accepted
**Date:** 2026-03-18
**Source:** [Conversation 001](../conversations/001-initial-planning.md)

## Context

Tom wants to explore unconventional tool architectures, including an `ask()` meta-tool where the agent dispatches natural language requests to sub-agents (e.g., "ask('What are the contents of README.md')"). This requires the agent's LLM interaction layer to be reusable — a sub-agent is essentially another LLM call with a different system prompt.

## Decision

The `LlmClient` in `packages/agent/src/llm.ts` is intentionally stateless and reusable. It takes messages in, streams a response out, and holds no conversation state. This means:

- Sub-agents are additional `LlmClient` instances with different system prompts
- The parent agent's tool executor calls a sub-agent, collects its result, and decides what to stream back to the server
- No architectural changes are needed to support the `ask()` pattern or other sub-agent dispatch models

Two visibility levels are possible:
- **Opaque**: sub-agent work is internal, user sees only the final result (works with zero changes)
- **Transparent**: user watches sub-agent reasoning in real-time (would need scoped events with parentId/depth in the protocol — a future enhancement)

## Consequences

- `LlmClient` must remain decoupled from the WebSocket connection layer
- The separation of `llm.ts` (LLM interaction) and `connection.ts` (WebSocket management) is load-bearing, not incidental
- Opaque sub-agents require zero additional infrastructure
- Transparent sub-agents would require protocol additions but no architectural changes
