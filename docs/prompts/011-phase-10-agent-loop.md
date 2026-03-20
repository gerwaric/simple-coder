# Phase 10: Agent Tool Loop

Read `docs/coding-agent-plan.md` and `docs/progress.md` for full context.

## Task

Replace the agent's single-call `runLlmTurn` with an own agent loop that supports tool execution, approval flow, and context management. This is the core behavioral change that makes the system a coding agent.

## Tool Definitions (packages/agent/src/tools.ts — new file)

Define tools in the Vercel AI SDK tool format for passing to `streamText`:

```typescript
import { tool } from "ai";
import { z } from "zod";

export const agentTools = {
  bash: tool({
    description: "Run a shell command in the workspace",
    parameters: z.object({ command: z.string() }),
  }),
  read_file: tool({
    description: "Read the contents of a file",
    parameters: z.object({ path: z.string() }),
  }),
  write_file: tool({
    description: "Write content to a file",
    parameters: z.object({ path: z.string(), content: z.string() }),
  }),
  context: tool({
    description: "Manage your context window. Actions: status (view token usage and message states), drop (remove messages from context), activate (restore messages to context), summarize (replace messages with a summary)",
    parameters: z.object({
      action: z.enum(["status", "drop", "activate", "summarize"]),
      messageIds: z.array(z.string()).optional(),
      summary: z.string().optional(),
    }),
  }),
  ask_human: tool({
    description: "Ask the user a question and wait for their response. Use when uncertain about approach, requirements, or preferences.",
    parameters: z.object({ question: z.string() }),
  }),
};
```

Note: Do NOT provide `execute` functions in the tool definitions — we are running our own loop and handling execution ourselves.

## Tool Executor (packages/agent/src/tool-executor.ts — new file)

Implement execution for each tool:

### bash
- Use `child_process.execSync` or `child_process.exec` (with promise wrapper)
- Set cwd to the workspace directory
- Capture stdout, stderr, exit code
- Return `{ stdout, stderr, exitCode }`
- Wrap in try/catch — errors become the tool result

### read_file
- Use `fs.readFile`
- Return `{ content }` or `{ error }` if file not found

### write_file
- Use `fs.writeFile` (create directories with `fs.mkdir` recursive if needed)
- Return `{ success: true }` or `{ error }`

### context
- Make HTTP requests to the server API:
  - `status` → `GET /api/sessions/:id/context`
  - `drop` → `PATCH /api/messages/:id/context-status` with `{ status: "inactive" }` for each ID
  - `activate` → `PATCH /api/messages/:id/context-status` with `{ status: "active" }` for each ID
  - `summarize` → `POST /api/sessions/:id/summaries` with `{ content, messageIds, createdBy: "agent" }`
- The agent needs the server's HTTP URL (derive from WS URL, or pass as env var)

### ask_human
- This is handled specially in the agent loop — it sends a `tool:approval:request` and waits for response. Not executed by the tool executor.

## Safety Check (packages/agent/src/safety.ts — new file)

Three-way classification: execute (safe), approve (consequential), or ask_human (blocks for user text).

```typescript
export type ToolAction = "execute" | "approve" | "ask_human";

export function assessToolCall(
  toolName: string,
  _args: unknown,
): { action: ToolAction } {
  if (toolName === "ask_human") return { action: "ask_human" };
  const safeTools = ["read_file", "context"];
  return { action: safeTools.includes(toolName) ? "execute" : "approve" };
}
```

## Dynamic System Prompt (packages/agent/src/system-prompt.ts — new file)

Build the system prompt per-call. `maxTokens` comes from `LLM_MAX_TOKENS` env var (default 128000):

```typescript
export function buildSystemPrompt(state: {
  workingDir: string;
  clonedRepos: string[];
  usedTokens: number;
  maxTokens: number; // from Number(process.env.LLM_MAX_TOKENS) || 128000
}): string {
  const pct = Math.round((state.usedTokens / state.maxTokens) * 100);
  const warning = pct > 70
    ? "\nWARNING: Context is above 70%. Summarize or drop old messages before continuing."
    : "";

  return `You are a coding agent working in a sandboxed container. You have access to tools for reading and writing files, running shell commands, managing your context window, and asking the user questions.

When you need to explore code, use read_file or bash. When you need to make changes, use write_file. For general-purpose tasks (git, installing packages, running tests), use bash.

When you are uncertain about the user's intent, requirements, or preferences, use ask_human to ask them rather than guessing.

Manage your context proactively. When you've gathered information from files, consider summarizing old messages to free up space. Use the context tool to check your budget and manage message states.

Working directory: ${state.workingDir}
Cloned repos: ${state.clonedRepos.length > 0 ? state.clonedRepos.join(", ") : "none yet"}
Context: ~${state.usedTokens.toLocaleString()} / ${state.maxTokens.toLocaleString()} tokens (${pct}%)${warning}

Reminders:
- Use ask_human when uncertain — don't guess
- Mutating actions (write_file, bash) require user approval
- When context exceeds 70%, summarize or drop old messages
- Keep the user informed of what you're doing and why`;
}
```

## Agent Loop (packages/agent/src/connection.ts — modify runLlmTurn)

Replace the current `runLlmTurn` with a tool loop. The high-level flow:

1. Filter `messageHistory` to only `active` messages (respect contextStatus)
2. Build dynamic system prompt with current state (including token budget from `LLM_MAX_TOKENS` env var, default 128000)
3. Translate messages to Vercel AI SDK format (handle tool_call/tool_result roles)
4. Call `streamText` with tool definitions (from tools.ts) but no execute functions
5. Stream thinking + text tokens to server (same as current)
6. When the LLM produces tool calls:
   a. For each tool call, generate a UUID via `crypto.randomUUID()` as the toolCallId
   b. Persist the tool_call as a message (send `tool:call` to server with agent-generated ID)
   c. Check `assessToolCall` — returns `{ action: "execute" | "approve" | "ask_human" }`
   d. If `execute` → run locally via tool executor
   e. If `approve` → send `tool:approval:request`, wait for `tool:approval:response`
   f. If `ask_human` → send `tool:approval:request`, wait for response text
   g. Persist tool result as a message (send `tool:result` to server)
   h. Add both tool_call and tool_result to local messageHistory
7. If the LLM produced tool calls, loop back to step 1
8. If the LLM produced only text (no tool calls), add the assistant message and we're done

### Waiting for approval

Add a mechanism for the agent to wait for approval responses. When the agent sends `tool:approval:request`, it needs to block until `tool:approval:response` arrives via WebSocket.

Approach: use a Promise with a resolver stored in a map keyed by toolCallId. When `tool:approval:response` arrives in `handleMessage`, resolve the corresponding promise.

```typescript
private approvalResolvers = new Map<string, (response: ToolApprovalResponse) => void>();

// In the tool loop:
const response = await this.waitForApproval(toolCallId);

private waitForApproval(toolCallId: string): Promise<ToolApprovalResponse> {
  return new Promise(resolve => {
    this.approvalResolvers.set(toolCallId, resolve);
  });
}

// In handleMessage for tool:approval:response:
const resolver = this.approvalResolvers.get(msg.toolCallId);
if (resolver) {
  resolver(msg);
  this.approvalResolvers.delete(msg.toolCallId);
}
```

### Message format translation

The Vercel AI SDK expects messages in its format. Create a translation function:

```typescript
function toSdkMessages(messages: Message[]): CoreMessage[] {
  // Map our flat message list to SDK format:
  // - role: "user" | "assistant" → pass through with content
  // - role: "tool_call" → becomes part of an assistant message with toolCalls
  // - role: "tool_result" → becomes a tool message with toolCallId
  // Handle thinking by excluding it (already not sent to LLM)
}
```

This is the trickiest part — the SDK combines assistant text + tool calls into one message, while we store them separately. The translation needs to merge adjacent assistant + tool_call messages.

### Workspace state tracking

Track workspace state in the AgentConnection:
- `workingDir: string` — starts as `/workspace`, updated if bash changes directory
- `clonedRepos: string[]` — track git clone commands in bash results

## Handle new ServerToAgent messages

In `handleMessage`, add cases for:
- `tool:approval:response` — resolve the pending approval promise
- `context:updated` — update local messageHistory to reflect context changes made from the UI

## Verification

1. `pnpm build` succeeds
2. Start Postgres + server + agent
3. Create a session, send "What files are in the current directory?"
4. Agent should call `bash` with `ls` → approval prompt appears in server logs (no UI yet)
5. Simulate approval via curl (`POST /api/tools/:callId/approve`)
6. Agent executes, sends result, LLM continues with response
7. Test `read_file` — should execute without approval
8. Test that the agent handles rejection (LLM told the tool was rejected)
9. Verify messages are persisted correctly in DB with all new fields

## On Completion

Update `docs/progress.md`. Commit with message: "Phase 10 — agent tool loop with approval flow"
