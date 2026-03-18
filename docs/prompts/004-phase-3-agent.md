# Phase 3: Agent Daemon

Read `docs/implementation-plan.md` and `docs/progress.md` for full context.

## Task

Implement the headless agent daemon: CLI entry point, WebSocket connection to server with reconnection, and LLM client via Vercel AI SDK. Zero tools — pure conversational loop.

## CLI Entry Point (packages/agent/src/index.ts)

- Generate agentId from env or random UUID
- Read SERVER_WS_URL from env (default: ws://localhost:3000/ws/agent)
- Instantiate LlmClient and AgentConnection
- Start connection

## WebSocket Connection (packages/agent/src/connection.ts)

AgentConnection class:
- Connect to server WebSocket
- Send `agent:register` with agentId and AGENT_SECRET
- Send `agent:ready`
- Handle incoming messages:
  - `session:assign`: store session + message history, run LLM turn
  - `user:message`: append to history, run LLM turn
  - `session:stop`: abort current LLM call if in progress, clear session, send agent:ready
- Reconnection with exponential backoff on disconnect
- Graceful shutdown on SIGTERM/SIGINT

## LLM Client (packages/agent/src/llm.ts)

LlmClient class — stateless and reusable:
- Constructor: configure provider based on LLM_PROVIDER env var
  - "anthropic": @ai-sdk/anthropic
  - "openai": @ai-sdk/openai
  - "openai-compatible": @ai-sdk/openai with custom baseURL (for llama.cpp)
- chat(messages) method: async generator yielding { type: "thinking" | "text", content: string }
  - Uses Vercel AI SDK streamText
  - Iterates reasoningStream (thinking tokens) then textStream (response tokens)
  - Returns full thinking + content when done
- System prompt: "You are a helpful coding assistant."
- Support AbortController for cancellation (used by session:stop)

## Message Flow

1. Receive session:assign → store session, call runLlmTurn(messages)
2. runLlmTurn: call llm.chat(messages)
3. For each thinking chunk → send thinking:token to server
4. When thinking done → send thinking:complete
5. For each text chunk → send assistant:token to server
6. When text done → send assistant:message:complete with full message (content + thinking)
7. Stay assigned to session, wait for next user:message or session:stop

## Verification

1. `pnpm build` succeeds
2. Start Postgres + server + agent
3. Server logs show agent registered
4. Create session via curl → agent receives session:assign
5. Agent calls LLM, streams response tokens back to server. If using Anthropic, verify thinking tokens also stream (requires explicit extended thinking opt-in via providerOptions).
6. Server persists completed assistant message in DB
7. Send another user message → agent responds again
8. Stop session → agent acknowledges, signals ready

## On Completion

Update `docs/progress.md`. Commit with message: "Phase 3 — agent daemon with LLM streaming"
