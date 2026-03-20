# Phase 10a: Agent Tool Loop

Read `docs/coding-agent-plan.md` and `docs/progress.md` for full context. Phases 8a and 9a must be complete before starting this. Context management phases (8b, 9b) are NOT required — the tool loop works without them.

## Task

Replace the agent's single-call `runLlmTurn` with an own agent loop that supports tool execution and the approval flow. The context tool and dynamic system prompt come in Phase 10b.

## Tool Definitions (packages/agent/src/tools.ts — new file)

Define tools in the Vercel AI SDK tool format for passing to `streamText`. Do NOT include the `context` tool yet — that comes in 10b.

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
  ask_human: tool({
    description: "Ask the user a question and wait for their response. Use when uncertain about approach, requirements, or preferences.",
    parameters: z.object({ question: z.string() }),
  }),
};
```

Note: Do NOT provide `execute` functions — we run our own loop.

## Tool Executor (packages/agent/src/tool-executor.ts — new file)

Implement execution for each tool:

### bash
- Use `child_process.exec` (with promise wrapper)
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

### ask_human
- Handled specially in the agent loop (not by the executor)

## Safety Check (packages/agent/src/safety.ts — new file)

All bash commands require approval (no read-only exceptions).

```typescript
export type ToolAction = "execute" | "approve" | "ask_human";

export function assessToolCall(
  toolName: string,
  _args: unknown,
): { action: ToolAction } {
  if (toolName === "ask_human") return { action: "ask_human" };
  const safeTools = ["read_file"];
  return { action: safeTools.includes(toolName) ? "execute" : "approve" };
}
```

Note: `context` is not in the safe list yet — it's added in Phase 10b.

## System Prompt (packages/agent/src/system-prompt.ts — new file)

A static system prompt for now. The dynamic token budget comes in Phase 10b.

```typescript
export function buildSystemPrompt(): string {
  return `You are a coding agent working in a sandboxed container. You have access to tools for reading and writing files, running shell commands, and asking the user questions.

When you need to explore code, use read_file or bash. When you need to make changes, use write_file. For general-purpose tasks (git, installing packages, running tests), use bash. Your workspace starts at /workspace — use pwd or ls to orient yourself.

When you are uncertain about the user's intent, requirements, or preferences, use ask_human to ask them rather than guessing.

Reminders:
- Use ask_human when uncertain — don't guess
- Mutating actions (write_file, bash) require user approval
- Keep the user informed of what you're doing and why`;
}
```

## Agent Loop (packages/agent/src/connection.ts — modify runLlmTurn)

Replace the current `runLlmTurn` with a tool loop:

1. Build system prompt (static for now)
2. Translate messages to Vercel AI SDK format (handle tool_call/tool_result roles)
3. Call `streamText` with tool definitions (from tools.ts) but no execute functions
4. Stream thinking + text tokens to server (same as current)
5. When the LLM produces tool calls:
   a. For each tool call, generate a UUID via `crypto.randomUUID()` as the toolCallId
   b. Check `assessToolCall` — returns `{ action: "execute" | "approve" | "ask_human" }`
   c. If `execute`:
      - Execute locally via tool executor
      - Send `tool:call` to server (server persists the tool_call message)
      - Send `tool:result` to server (server persists the tool_result message)
   d. If `approve`:
      - Send `tool:approval:request` to server (server persists as tool_call with pending status)
      - Wait for `tool:approval:response`
      - If approved → execute locally, send `tool:result` to server
      - If rejected → send `tool:result` with rejection message to server
   e. If `ask_human`:
      - Send `tool:approval:request` to server (server persists as tool_call with pending status)
      - Wait for `tool:approval:response` (which includes the user's text)
      - Send `tool:result` with the human's answer to server
   f. Add both tool_call and tool_result to local messageHistory
6. If the LLM produced tool calls, loop back to step 1
7. If the LLM produced only text (no tool calls), add the assistant message and we're done

**Important:** Each tool call follows exactly one persistence path. Safe tools send `tool:call` (already executed). Approval-needed tools send `tool:approval:request` (not yet executed). Never both for the same tool call.

### Waiting for approval

```typescript
private approvalResolvers = new Map<string, (response: ToolApprovalResponse) => void>();

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

Create a translation function:
```typescript
function toSdkMessages(messages: Message[]): CoreMessage[] {
  // Map our flat message list to SDK format:
  // - role: "user" | "assistant" → pass through with content
  // - role: "tool_call" → becomes part of an assistant message with toolCalls
  // - role: "tool_result" → becomes a tool message with toolCallId
  // The SDK combines assistant text + tool calls into one message,
  // while we store them separately. Merge adjacent assistant + tool_call messages.
}
```

### Handle new ServerToAgent message

In `handleMessage`, add case for:
- `tool:approval:response` — resolve the pending approval promise

## Verification

1. `pnpm build` succeeds
2. Start Postgres + server + agent
3. Create a session, send "What files are in the current directory?"
4. Agent should call `bash` with `ls` → approval request appears in server logs
5. Simulate approval via curl (`POST /api/tools/:toolCallId/approve`)
6. Agent executes, sends result, LLM continues with response
7. Test `read_file` — should execute without approval
8. Test that the agent handles rejection (LLM told the tool was rejected)
9. Verify messages are persisted correctly in DB with tool fields

## On Completion

Update `docs/progress.md`. Commit with message: "Phase 10a — agent tool loop with approval flow"
