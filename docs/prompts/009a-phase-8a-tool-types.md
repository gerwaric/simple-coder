# Phase 8a: Tool Types + Schema

Read `docs/coding-agent-plan.md` and `docs/progress.md` for full context.

## Task

Add the data model for tool calls and approval flow. This is the first half of Phase 8 — context management types come in 8b. No behavioral changes yet, just types, schema, and query functions.

## Shared Constants (packages/shared/src/constants.ts)

Expand MessageRole:
```typescript
export const MessageRole = {
  User: "user",
  Assistant: "assistant",
  System: "system",
  ToolCall: "tool_call",
  ToolResult: "tool_result",
} as const;
```

Add ApprovalStatus:
```typescript
export const ApprovalStatus = {
  Pending: "pending",
  Approved: "approved",
  Rejected: "rejected",
} as const;
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];
```

## Shared Types (packages/shared/src/types.ts)

Add tool-related fields to Message:
```typescript
export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  thinking: string | null;
  toolName: string | null;
  toolArgs: Record<string, unknown> | null;
  toolCallId: string | null;
  approvalStatus: ApprovalStatus | null;
  createdAt: string;
}
```

Note: `contextStatus` and `tokenCount` are NOT added yet — those come in Phase 8b.

## WebSocket Messages (packages/shared/src/ws-messages.ts)

Update existing `ToolCall` and `ToolResult` interfaces to include `toolCallId`:
```typescript
export interface ToolCall {
  type: "tool:call";
  sessionId: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  type: "tool:result";
  sessionId: string;
  toolCallId: string;
  toolName: string;
  result: unknown;
}
```

Add new Agent → Server message:
```typescript
export interface ToolApprovalRequest {
  type: "tool:approval:request";
  sessionId: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}
```

Add new Server → Agent message:
```typescript
export interface ToolApprovalResponse {
  type: "tool:approval:response";
  toolCallId: string;
  approved: boolean;
  response?: string; // For ask_human — the user's text response
}
```

Add new Server → UI message:
```typescript
export interface UIToolApprovalRequest {
  type: "tool:approval:request";
  sessionId: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}
```

Update the union types (AgentToServer, ServerToAgent, ServerToUI) to include the new message types.

## Database Schema (packages/server/src/db/schema.sql)

Update the messages table (no migration framework — update the CREATE TABLE):
- Add `tool_name TEXT`
- Add `tool_args JSONB`
- Add `tool_call_id TEXT`
- Add `approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected'))`
- Expand the role CHECK constraint to include `'tool_call'` and `'tool_result'`

Do NOT add `context_status` or `token_count` columns yet — those come in Phase 8b.

## Database Queries (packages/server/src/db/queries.ts)

Update existing query functions to handle the new message columns. Add:
- `getMessageByToolCallId(toolCallId)` — fetch a message by toolCallId (for approval lookups)
- `updateApprovalStatus(messageId, status)` — update approval status
- `getMessageById(messageId)` — fetch a single message (if not already present)

## Incremental Tests

Add or update integration tests for:
- Inserting a message with tool_call role, toolName, toolArgs, toolCallId — verify it round-trips through the DB
- Inserting a message with approvalStatus — verify it persists and reads back correctly
- `getMessageByToolCallId` — verify lookup works
- `updateApprovalStatus` — verify it updates correctly
- Existing tests still pass (may need minor updates for new nullable fields)

## Verification

1. `pnpm build` succeeds across all packages
2. Drop and recreate the database, verify schema applies cleanly
3. New tests pass
4. Existing tests still pass

## On Completion

Update `docs/progress.md`. Commit with message: "Phase 8a — tool types and schema for approval flow"
