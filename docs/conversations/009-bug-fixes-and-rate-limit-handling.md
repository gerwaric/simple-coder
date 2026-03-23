# Bug Fixes and Rate Limit Handling
**Date:** 2026-03-22

## Decisions Made
- [ADR-034: Transient Agent Warnings](../decisions/034-transient-agent-warnings.md)
- [ADR-035: Context Status Broadcast on Agent Messages](../decisions/035-context-status-broadcast-on-agent-messages.md)

## Discussion

### Token Count Bug

**Tom:** There is a bug in the UI where the token count isn't updated as the agent is performing actions. I can see stuff showing up in the chat history, but the token count doesn't change until I interact with it, e.g. by toggling one section into and out of the context.

**Claude:** Investigated the full flow. The `context:status` WebSocket broadcast is only triggered by user-initiated actions (drop/restore messages, create/delete summaries). When the agent creates new messages — assistant responses, tool calls, tool results — the server never calls `broadcastContextStatus()`. The flow gap is in `packages/server/src/ws/agent-ws.ts`. The fix is to add `broadcastContextStatus()` calls after each message is persisted.

**Tom:** Yes, please fix it.

**Claude:** Added a `refreshContextStatus()` helper inside `agent-ws.ts` and called it after `assistant:message:complete`, `tool:call`, `tool:result`, and `tool:approval:request`. Build succeeds.

**Tom:** I think that's working now. Let's commit.

**Claude:** Committed as `f33714a`: "Fix UI token count not updating during agent activity".

### Stuck Agent Session

**Tom:** The agent got stuck. The last message I see is "Let's check the cargo.toml to understand the rust structure" and there's no output after that.

**Claude:** Checked Docker logs, database state. Found two sessions stuck in `active` state assigned to `agent-a515930d`, but that agent is no longer running. The `removeAgent` function only returns a single `currentSessionId`, so on disconnect it can only recover one session.

**Tom:** I'm running locally using pnpm right now.

**Claude:** Suggested running SQL to reset the stuck sessions to `pending` state. After restarting, one session was pending. Tom stopped the other session, and the pending one became active but the agent wasn't responding.

**Tom:** The agent isn't responding after I sent "please continue".

**Claude:** Read through the agent's `connection.ts`. The `runToolLoop` was being called but producing no console output — not even error messages. The LLM API call appeared to be hanging. Suggested starting a fresh session to test.

**Tom:** I was able to start a new session which worked fine.

**Claude:** Confirmed the problem was specific to that session's message history, not a systemic issue.

### Adding Debug Logging

**Tom:** Can you investigate what's happening with the stuck session?

**Claude:** Added debug logging to `runToolLoop`: log before `streamText` call (message count, token estimate), log when first stream chunk arrives, log when stream completes, log tool calls, and full stack trace on errors.

**Tom:** I restarted and before I had a chance to check the UI, I saw the agent was assigned the old session and the first chunk type was "error".

**Claude:** The stream emits an error part but doesn't throw — the `for await` loop processes it silently, then hangs on `await result.toolCalls`. Added error stream part detection that breaks out of the stream loop and bails out before `result.toolCalls`.

### Discovering the Rate Limit Error

**Tom:** Bingo! The error is a 429 rate limit — 30,000 input tokens per minute.

**Claude:** The agent was making rapid-fire LLM calls during the tool loop and hit the rate limit. The Vercel AI SDK retried but exhausted retries, then surfaced it as a stream error which the old code silently ignored. The original "stuck agent" was rate limiting all along, not a malformed history problem.

### Designing the Warning System

**Tom:** We should surface the error to the UI. Can I throw money at this problem, or do we need exponential backoff?

**Claude:** Anthropic has higher rate limit tiers — your current 30k is the lowest. The SDK already has retry logic but it's insufficient. Recommended both: handle 429s gracefully (detect, wait for reset, retry) short term, and upgrade the tier longer term. Backoff is more robust because even high-tier limits can be hit with a fast enough tool loop.

**Tom:** Can we report to the user in the UI when a 429 is hit and the agent is waiting?

**Claude:** Yes. Proposed three options: (A) new WS message type, (B) send as assistant message (pollutes LLM history), (C) broadcast-only UI notification without DB persistence. Recommended option C — right semantics for transient operational status, keeps message history clean.

**Tom:** Yes, I like that idea.

**Claude:** Proposed: `agent:warning` message type with `sessionId`, `message` string, and optional `retryAt` ISO timestamp. Agent sends when it detects a 429. Server relays to UI. UI renders as inline notice with live countdown.

**Tom:** Will the notice have a countdown timer, or at least a "resuming at" message?

**Claude:** The 429 response includes `anthropic-ratelimit-input-tokens-reset` with an exact reset timestamp. Will include a live countdown that ticks down.

### Implementation and Debugging the Error Extraction

**Tom:** I got the rate limit error, and instead of a countdown I see "LLM error — aborting current turn".

**Claude:** The `extractRateLimitReset` was checking `error.cause.statusCode` but the error structure was different. Added debug logging to inspect the actual error shape.

**Tom:** Here's the output: `error keys: [ 'name', 'cause', 'reason', 'errors', 'lastError' ]`, `error.statusCode: undefined`, `error.cause?.statusCode: undefined`.

**Claude:** The `statusCode` isn't on `cause` — it's a retry wrapper with a `lastError` property. Added more debug logging for `lastError`.

**Tom:** `error.lastError?.statusCode: 429`, `error.lastError?.responseHeaders: { ... anthropic-ratelimit-input-tokens-reset: '2026-03-22T23:59:28Z' ... }`

**Claude:** Updated `extractRateLimitReset` to walk through all possible locations: `error`, `error.cause`, `error.lastError`, `error.lastError.cause`.

**Tom:** I now get the countdown timer. Is the value of the delay derived from the API response?

**Claude:** Yes — extracted from `anthropic-ratelimit-input-tokens-reset` header, with a 1-second buffer added.

**Tom:** The agent successfully retried and resumed after the countdown.

### Keeping Warnings in History

**Tom:** Would it be hard to keep the rate limit notices in the chat history window, so I can scroll back and see when they happened? I love the countdown timer, but also want "waiting for reset" to say "waiting <duration> to continue".

**Claude:** Changed from a single warning per session to an array. Warnings are pushed onto a list and rendered as timeline items sorted chronologically with messages. Active warnings show amber with "waiting Xs to continue"; past warnings fade to grey. Updated `WarningBanner` component, `useSessions` state management, and `ChatPanel` display list.

**Tom:** It works now.

### Cleanup and Commit

**Tom:** What docs should we update with this commit?

**Claude:** README (WebSocket protocol section mentions message types, added `agent:warning` and error handling section) and ADRs via `/conversation-notes`. Committed as `be225c6`: "Rate limit handling with UI warning banner and retry".

### Debug Logging Decision

**Tom:** Should we keep the `[llm]` debug log lines?

**Claude:** Three options: keep as-is, remove, or gate behind DEBUG env var.

**Tom:** Keep them.

**Claude:** Agreed — they're low-volume (one per LLM call) and invaluable for diagnosing issues.
