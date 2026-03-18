# Protocol Extensibility
**Status:** Accepted
**Date:** 2026-03-18
**Source:** [Conversation 001](../conversations/001-initial-planning.md)

## Context

The spec lists three event types: tool calls, thinking tokens, and assistant messages. We're only implementing thinking + assistant messages initially, but the protocol should accommodate all three from the start. Additionally, HumanLayer's product is about human-in-the-loop control of AI agents — the architecture should naturally support approval patterns.

## Decision

Define `tool:call` and `tool:result` message types in `ws-messages.ts` as part of the protocol's TypeScript discriminated union, on both the agent↔server and server→UI channels. Nothing sends these messages yet — they are typed placeholders.

The server-as-broker architecture naturally supports human-in-the-loop approval: when tools are added, the server can hold a tool call pending until a human approves it via the UI, then relay the approval to the agent.

## Consequences

- Adding tools later requires implementing a tool executor and UI rendering, but no protocol or infrastructure changes
- The TypeScript types serve as documentation of the protocol's intended scope
- The human-in-the-loop approval pattern is an architectural capability, not a feature — it requires no code today but is enabled by the broker design
- Reviewers can see the extensibility path in the type definitions
