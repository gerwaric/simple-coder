# Transient Agent Warnings
**Status:** Accepted
**Date:** 2026-03-22
**Source:** [Conversation 009](../conversations/009-bug-fixes-and-rate-limit-handling.md)

## Context
The agent's tool loop makes rapid-fire LLM API calls, each carrying the full message history. With a 30,000 input token/minute rate limit, the agent frequently hits HTTP 429 errors. These errors were silently swallowed because the Vercel AI SDK surfaces them as stream parts (type: "error") rather than thrown exceptions, causing the agent to appear stuck with no feedback to the user.

We needed a way to surface operational status (rate limits, transient errors) to the user without polluting the persistent message history that gets sent back to the LLM on subsequent calls.

## Decision
Added a new `agent:warning` WebSocket message type that flows from agent → server → UI without database persistence. The server relays these as a simple broadcast — no storage, no query impact.

For rate limit errors specifically, the agent extracts the `anthropic-ratelimit-input-tokens-reset` header from the API response, waits until the reset time, and retries the LLM call. The warning includes the `retryAt` timestamp so the UI can show a live countdown.

The UI renders warnings inline in the chat timeline (sorted chronologically with messages), not as a top-level error bar. Active warnings show an amber banner with "waiting Xs to continue"; past warnings fade to grey. Warnings are kept in the timeline as historical markers, not cleared when the agent resumes.

## Consequences
- Rate limit errors no longer silently kill the agent's turn — the agent waits and retries automatically
- Users see exactly what's happening and when it will resolve
- Warning messages don't contaminate the LLM's context (not persisted to DB, not included in message history)
- The `agent:warning` message type is generic enough for future operational warnings beyond rate limits
- Warnings are ephemeral — they exist only in the UI's in-memory state for the current browser session, which is the right durability for transient operational status
