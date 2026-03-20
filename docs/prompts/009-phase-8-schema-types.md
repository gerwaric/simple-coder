# Phase 8: Schema + Type Updates

Read `docs/coding-agent-plan.md` and `docs/progress.md` for full context.

## Task

Expand the shared types, database schema, and WebSocket protocol to support tools, approval flow, and context management. This is the foundation everything else builds on — no behavioral changes yet, just the data model.

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

Add ContextStatus:
```typescript
export const ContextStatus = {
  Active: "active",
  Summarized: "summarized",
  Inactive: "inactive",
} as const;
export type ContextStatus = (typeof ContextStatus)[keyof typeof ContextStatus];
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

Expand the Message interface:
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
  contextStatus: ContextStatus;
  approvalStatus: ApprovalStatus | null;
  tokenCount: number | null;
  createdAt: string;
}
```

Add Summary type:
```typescript
export interface Summary {
  id: string;
  sessionId: string;
  content: string;
  tokenCount: number | null;
  createdBy: "agent" | "user";
  messageIds: string[];
  createdAt: string;
}
```

## WebSocket Messages (packages/shared/src/ws-messages.ts)

Add new Agent → Server messages:
```typescript
export interface ToolApprovalRequest {
  type: "tool:approval:request";
  sessionId: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}
```

Add new Server → Agent messages:
```typescript
export interface ToolApprovalResponse {
  type: "tool:approval:response";
  toolCallId: string;
  approved: boolean;
  response?: string; // For ask_human — the user's text response
}

export interface ContextUpdated {
  type: "context:updated";
  sessionId: string;
  messageIds: string[];
  contextStatus: ContextStatus;
}
```

Add new Server → UI messages:
```typescript
export interface UIToolApprovalRequest {
  type: "tool:approval:request";
  sessionId: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface UIContextUpdated {
  type: "context:updated";
  sessionId: string;
  messageIds: string[];
  contextStatus: ContextStatus;
}

export interface UIContextStatus {
  type: "context:status";
  sessionId: string;
  usedTokens: number;
  maxTokens: number;
}
```

Update the existing `ToolCall` and `ToolResult` interfaces to include `toolCallId`:
```typescript
export interface ToolCall {
  type: "tool:call";
  sessionId: string;
  toolCallId: string;   // NEW — links call to result
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  type: "tool:result";
  sessionId: string;
  toolCallId: string;   // NEW — references the tool:call
  toolName: string;
  result: unknown;
}
```

Update the union types (AgentToServer, ServerToAgent, ServerToUI) to include the new message types.

## Database Schema (packages/server/src/db/schema.sql)

Update the messages table — since we don't have a migration framework, update the CREATE TABLE statement to include all new columns. Also update the role CHECK constraint.

Add the summaries and summary_messages tables as specified in the coding-agent-plan.md.

## Database Queries (packages/server/src/db/queries.ts)

Update existing query functions to handle the new message columns. Add new query functions:
- `getActiveMessages(sessionId)` — returns messages with contextStatus='active', plus summaries for summarized messages
- `updateContextStatus(messageId, status)` — update a message's contextStatus
- `createSummary(sessionId, content, createdBy, messageIds)` — create summary + join table entries, set messages to 'summarized'
- `deleteSummary(summaryId)` — delete summary, set messages back to 'active'
- `getContextStatus(sessionId)` — return token counts and message states
- `updateApprovalStatus(messageId, status)` — update approval status
- `getMessageById(messageId)` — fetch a single message

## Verification

1. `pnpm build` succeeds across all packages
2. The shared types compile with no errors
3. Drop and recreate the database, verify schema applies cleanly
4. Existing tests still pass (they may need minor updates for the new Message fields)
5. Manually verify: insert a message with the new fields, read it back

## On Completion

Update `docs/progress.md`. Commit with message: "Phase 8 — schema and type updates for coding agent"
