# Phase 8b: Context Management Types + Schema

Read `docs/coding-agent-plan.md` and `docs/progress.md` for full context. Phase 8a must be complete before starting this.

## Task

Add the data model for context management: context status on messages, token counting, summaries table, and associated query functions. This completes the schema layer for the coding agent.

## Shared Constants (packages/shared/src/constants.ts)

Add ContextStatus:
```typescript
export const ContextStatus = {
  Active: "active",
  Summarized: "summarized",
  Inactive: "inactive",
} as const;
export type ContextStatus = (typeof ContextStatus)[keyof typeof ContextStatus];
```

## Shared Types (packages/shared/src/types.ts)

Add context fields to Message (building on 8a):
```typescript
export interface Message {
  // ... existing fields from 8a ...
  contextStatus: ContextStatus;
  tokenCount: number | null;
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
  positionAt: string;  // earliest message's createdAt — determines transcript ordering
  createdAt: string;
}
```

## WebSocket Messages (packages/shared/src/ws-messages.ts)

Add new Server → Agent messages:
```typescript
export interface ContextUpdated {
  type: "context:updated";
  sessionId: string;
  messageIds: string[];
  contextStatus: ContextStatus;
}

export interface SummaryCreated {
  type: "summary:created";
  sessionId: string;
  summary: Summary;
}

export interface SummaryDeleted {
  type: "summary:deleted";
  sessionId: string;
  summaryId: string;
  restoredMessageIds: string[];
}
```

Add new Server → UI messages:
```typescript
export interface UIContextUpdated {
  type: "context:updated";
  sessionId: string;
  messageIds: string[];
  contextStatus: ContextStatus;
}

export interface UISummaryCreated {
  type: "summary:created";
  sessionId: string;
  summary: Summary;
}

export interface UISummaryDeleted {
  type: "summary:deleted";
  sessionId: string;
  summaryId: string;
  restoredMessageIds: string[];
}

export interface UIContextStatus {
  type: "context:status";
  sessionId: string;
  usedTokens: number;
  maxTokens: number;
}
```

Update the union types (ServerToAgent, ServerToUI) to include the new message types.

## Database Schema (packages/server/src/db/schema.sql)

Add to messages table:
- `context_status TEXT NOT NULL DEFAULT 'active' CHECK (context_status IN ('active', 'summarized', 'inactive'))`
- `token_count INTEGER`

Add new tables:
```sql
CREATE TABLE IF NOT EXISTS summaries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  token_count INTEGER,
  created_by  TEXT NOT NULL CHECK (created_by IN ('agent', 'user')),
  position_at TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS summary_messages (
  summary_id UUID NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  PRIMARY KEY (summary_id, message_id),
  UNIQUE (message_id)  -- Rule 1: a message can only belong to one summary
);
```

## Database Queries (packages/server/src/db/queries.ts)

Add new query functions:
- `getActiveMessages(sessionId)` — returns messages with contextStatus='active', plus summaries for summarized messages
- `updateContextStatus(messageId, status)` — update a message's contextStatus
- `createSummary(sessionId, content, createdBy, messageIds)` — create summary (with position_at from earliest message) + join table entries, set messages to 'summarized'
- `deleteSummary(summaryId)` — delete summary, set messages back to 'active'
- `getContextStatus(sessionId)` — return token counts and message states
- `getSummariesForSession(sessionId)` — get all summaries for a session

## Token Counting Utility

Create a simple token estimation function (can live in shared or server):
```typescript
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

Used when persisting messages (set tokenCount).

## Incremental Tests

Add integration tests for:
- Insert a message, verify `contextStatus` defaults to `'active'`
- `updateContextStatus` — change to inactive, verify it persists
- `createSummary` — create a summary over active messages, verify:
  - Summary row created with correct `position_at`
  - Join table entries created
  - Target messages set to `contextStatus = 'summarized'`
- `createSummary` constraint: cannot summarize a message that's already summarized (Rule 2)
- `createSummary` constraint: cannot add a message to two summaries (Rule 1 — DB unique constraint)
- `deleteSummary` — verify messages restored to active, summary and join rows deleted
- `getActiveMessages` — returns only active messages plus summaries
- `getContextStatus` — returns correct token counts
- `estimateTokens` — returns reasonable values
- Existing tests still pass

## Verification

1. `pnpm build` succeeds across all packages
2. Drop and recreate the database, verify schema applies cleanly (both new tables)
3. All new tests pass
4. All existing tests pass

## On Completion

Update `docs/progress.md`. Commit with message: "Phase 8b — context management types and schema"
