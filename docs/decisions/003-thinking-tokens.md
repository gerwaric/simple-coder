# Thinking Tokens in Protocol
**Status:** Accepted
**Date:** 2026-03-18
**Source:** [Conversation 001](../conversations/001-initial-planning.md)

## Context

The spec explicitly lists "thinking tokens" as one of three event types to stream (alongside tool calls and assistant messages). Some LLM providers (notably Anthropic) expose model reasoning as a separate stream. Including thinking tokens shows understanding of the full event model and makes the "watching the agent work" experience more compelling.

## Decision

Include thinking tokens in the protocol and database from day one:

- **Protocol**: `thinking:token` and `thinking:complete` on agent→server channel; `thinking:stream` on server→UI channel
- **Database**: nullable `thinking` column on the messages table
- **Agent**: Stream both `reasoningStream` and `textStream` from Vercel AI SDK's `streamText`
- **UI**: Display thinking tokens in a collapsible, visually distinct section above the response

If the LLM provider doesn't support thinking (OpenAI, llama.cpp), the reasoning stream is simply empty. No conditional logic needed.

## Consequences

- Low implementation effort — follows the same streaming pattern as assistant tokens
- Persisting thinking in the DB satisfies the spec's requirement that events are "saved to the database"
- UI needs a visual treatment for thinking vs response (collapsible section)
- Not all providers support thinking — graceful degradation is built in
