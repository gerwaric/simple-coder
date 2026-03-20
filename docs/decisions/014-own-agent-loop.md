# Own Agent Loop
**Status:** Accepted
**Date:** 2026-03-19
**Source:** [Conversation 002](../conversations/002-coding-agent-design.md)

## Context

The Vercel AI SDK provides a built-in tool loop via `streamText` — if you provide tool definitions and executors, it can auto-loop calling tools, feeding results back, and calling the LLM again. However, our approval flow and `ask_human` tool require pausing the loop to wait for human input.

The project definition evaluates design thinking. The assessment implicitly wants to see how you design an agent loop, not how you wrap someone else's.

## Decision

Run our own agent loop. Use the Vercel AI SDK only for:
- Streaming from the LLM (SSE handling, provider abstraction)
- Multi-provider support (Anthropic, OpenAI, OpenAI-compatible)
- Tool schema formatting via the `tools` parameter

The orchestration — calling the LLM, checking for tool calls, executing or pausing for approval, feeding results back, looping until done — is our own code:

```
while true:
  call LLM with message history
  stream thinking + text to server
  if no tool calls → done
  for each tool call:
    if needs approval → pause, wait for human
    execute tool
    add call + result to history
  continue loop
```

## Consequences

- Full control over when the loop pauses (approval, ask_human)
- The agent loop is visible, debuggable code — not hidden inside SDK internals
- We own the translation between our flat message format and the SDK's expected format
- Slightly more code than using the SDK's auto-loop, but straightforward
- Demonstrates understanding of agent architecture to reviewers
