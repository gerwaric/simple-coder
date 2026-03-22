# Configurable Token Budget
**Status:** Accepted
**Date:** 2026-03-22
**Source:** [Conversation 008](../conversations/008-filesystem-viewer-and-token-budget.md)

## Context

The context window size was hardcoded at 128,000 tokens via the `LLM_MAX_TOKENS` environment variable. This value drove the context gauge percentage and the agent's decisions about when to summarize or drop messages. Users had no way to adjust it without restarting the server. The term "max tokens" also implied a hard model limit, when in practice it's a user-chosen threshold for budget tracking.

## Decision

Rename the concept from "max tokens" to "token budget" to clarify it's a user-set threshold, not a model constraint. Make it configurable at runtime:

- **Server-side mutable state** in `packages/server/src/settings.ts` — initialized from `LLM_MAX_TOKENS` env var (default 128,000)
- **REST endpoints** `GET/PUT /api/settings/token-budget` for reading and updating
- **In-memory storage** — resets to the env var default on server restart (no database persistence)
- **UI control** — the budget number in the context gauge is clickable, opening an inline text input. Enter or blur commits the new value; Escape cancels.
- **Agent reads it passively** — the existing context status endpoint (`GET /api/sessions/:id/context`) returns the current `maxTokens` from the mutable setting, so the agent's summarization decisions automatically reflect the user's chosen budget with no agent code changes.

The token budget was placed server-side rather than UI-only because the agent needs to reason about it for context management decisions.

## Consequences

- Users can adjust the token budget from the UI without restarting the server
- The agent's context management behavior responds to the user's chosen budget
- The setting resets on server restart — acceptable for now; can be DB-backed later if needed
- The rename from "tokens" to "token budget" in the UI clarifies that this is a soft limit
- Minimum value of 1,000 tokens enforced by the PUT endpoint
