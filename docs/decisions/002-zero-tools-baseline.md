# Zero Tools Baseline
**Status:** Accepted
**Date:** 2026-03-18
**Source:** [Conversation 001](../conversations/001-initial-planning.md)

## Context

The assessment evaluates design thinking, not feature completeness. Tom wants to explore unconventional agent architectures (e.g., an `ask()` meta-tool that dispatches to sub-agents) and needs a clean baseline to experiment from. The infrastructure — WebSocket plumbing, real-time sync, database persistence, Docker Compose — represents ~80% of the engineering effort.

## Decision

Start with a zero-tool conversational chat agent. The agent runs a bare LLM loop via Vercel AI SDK: receive messages, call LLM, stream response back. No file operations, no shell execution, no tools of any kind. Multi-turn conversation from the start.

Tools will be added later as a deliberate, discussed iteration — not as part of the initial build.

## Consequences

- Forces the infrastructure to be solid before adding agent complexity
- Provides a clean baseline for experimenting with different tool architectures
- The initial deliverable can chat but cannot perform coding tasks on the host — the spec says "coding agent" so tools will need to follow
- The WebSocket protocol and database schema are designed with tool events in mind (placeholder types defined) so adding tools requires no infrastructure changes
