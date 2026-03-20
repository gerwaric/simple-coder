# Phase 10b: Context Tool + Dynamic System Prompt

Read `docs/coding-agent-plan.md` and `docs/progress.md` for full context. Phases 8b, 9b, and 10a must be complete before starting this.

## Task

Add the context tool to the agent, make the system prompt dynamic with token budget awareness, and handle context-related WebSocket messages from the server. This completes the agent's coding capabilities.

## Context Tool Definition (packages/agent/src/tools.ts)

Add the context tool to `agentTools`:
```typescript
context: tool({
  description: "Manage your context window. Actions: status (view token usage and message states), drop (remove messages from context), activate (restore messages to context), summarize (replace messages with a summary)",
  parameters: z.object({
    action: z.enum(["status", "drop", "activate", "summarize"]),
    messageIds: z.array(z.string()).optional(),
    summary: z.string().optional(),
  }),
}),
```

## Context Tool Executor (packages/agent/src/tool-executor.ts)

Add context tool execution — HTTP requests to the server API:
- `status` → `GET /api/sessions/:id/context`
- `drop` → `PATCH /api/messages/:id/context-status` with `{ status: "inactive" }` for each ID
- `activate` → `PATCH /api/messages/:id/context-status` with `{ status: "active" }` for each ID
- `summarize` → `POST /api/sessions/:id/summaries` with `{ content, messageIds, createdBy: "agent" }`

The agent needs the server's HTTP URL — derive from the WS URL or pass as env var.

## Safety Check Update (packages/agent/src/safety.ts)

Add `context` to the safe tools list:
```typescript
const safeTools = ["read_file", "context"];
```

## Dynamic System Prompt (packages/agent/src/system-prompt.ts)

Update `buildSystemPrompt` to accept state and include token budget:

```typescript
export function buildSystemPrompt(state: {
  usedTokens: number;
  maxTokens: number; // from Number(process.env.LLM_MAX_TOKENS) || 128000
}): string {
  const pct = Math.round((state.usedTokens / state.maxTokens) * 100);
  const warning = pct > 70
    ? "\nWARNING: Context is above 70%. Summarize or drop old messages before continuing."
    : "";

  return `You are a coding agent working in a sandboxed container. You have access to tools for reading and writing files, running shell commands, managing your context window, and asking the user questions.

When you need to explore code, use read_file or bash. When you need to make changes, use write_file. For general-purpose tasks (git, installing packages, running tests), use bash. Your workspace starts at /workspace — use pwd or ls to orient yourself.

When you are uncertain about the user's intent, requirements, or preferences, use ask_human to ask them rather than guessing.

Manage your context proactively. When you've gathered information from files, consider summarizing old messages to free up space. Use the context tool to check your budget and manage message states.

Context: ~${state.usedTokens.toLocaleString()} / ${state.maxTokens.toLocaleString()} tokens (${pct}%)${warning}

Reminders:
- Use ask_human when uncertain — don't guess
- Mutating actions (write_file, bash) require user approval
- When context exceeds 70%, summarize or drop old messages
- Keep the user informed of what you're doing and why`;
}
```

## Agent Loop Updates (packages/agent/src/connection.ts)

Update the tool loop from 10a:

1. **Filter by context status:** Before assembling messages for the LLM, filter `messageHistory` to only `active` messages
2. **Compute token budget:** Sum tokenCount of active messages, pass to `buildSystemPrompt`
3. **Fetch context status:** Before each LLM call, optionally fetch from `GET /api/sessions/:id/context` for accurate token counts (or maintain locally)

## Handle new ServerToAgent messages

In `handleMessage`, add cases for:
- `context:updated` — update local messageHistory to reflect context status changes made from the UI (drop/activate)
- `summary:created` — update local messageHistory to mark summarized messages, store the summary for context assembly
- `summary:deleted` — restore messages to active, remove the summary from local state

## Verification

1. `pnpm build` succeeds
2. Start Postgres + server + agent
3. Create a session, have a conversation that generates several messages
4. Agent can use `context` tool with `status` action — sees token counts
5. Agent can use `context` tool with `drop` action — messages become inactive
6. Agent can use `context` tool with `summarize` action — summary created, messages summarized
7. Dynamic system prompt shows correct token budget
8. When context > 70%, warning appears in system prompt
9. Verify messages persist correctly in DB with context fields

## On Completion

Update `docs/progress.md`. Commit with message: "Phase 10b — context tool and dynamic system prompt"
