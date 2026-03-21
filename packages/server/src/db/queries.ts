import type { Sql } from "postgres";
import type { Session, Message, Summary, SessionState, MessageRole, ApprovalStatus, ContextStatus } from "@simple-coder/shared";

interface SessionRow {
  id: string;
  state: SessionState;
  agent_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  thinking: string | null;
  tool_name: string | null;
  tool_args: Record<string, unknown> | null;
  tool_call_id: string | null;
  approval_status: ApprovalStatus | null;
  context_status: ContextStatus;
  token_count: number | null;
  created_at: string;
}

interface SummaryRow {
  id: string;
  session_id: string;
  content: string;
  token_count: number | null;
  created_by: "agent" | "user";
  position_at: string;
  created_at: string;
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    state: row.state,
    agentId: row.agent_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    thinking: row.thinking,
    toolName: row.tool_name,
    toolArgs: row.tool_args,
    toolCallId: row.tool_call_id,
    approvalStatus: row.approval_status,
    contextStatus: row.context_status,
    tokenCount: row.token_count,
    createdAt: row.created_at,
  };
}

export async function createSession(
  sql: Sql,
  title: string,
): Promise<Session> {
  const [row] = await sql<SessionRow[]>`
    INSERT INTO sessions (title) VALUES (${title}) RETURNING *
  `;
  return toSession(row);
}

export async function getSession(
  sql: Sql,
  id: string,
): Promise<Session | null> {
  const [row] = await sql<SessionRow[]>`
    SELECT * FROM sessions WHERE id = ${id}
  `;
  return row ? toSession(row) : null;
}

export async function listSessions(sql: Sql): Promise<Session[]> {
  const rows = await sql<SessionRow[]>`
    SELECT * FROM sessions ORDER BY created_at DESC
  `;
  return rows.map(toSession);
}

export async function deleteSession(
  sql: Sql,
  id: string,
): Promise<boolean> {
  const result = await sql`DELETE FROM sessions WHERE id = ${id}`;
  return result.count > 0;
}

export async function updateSessionTitle(
  sql: Sql,
  id: string,
  title: string,
): Promise<Session | null> {
  const [row] = await sql<SessionRow[]>`
    UPDATE sessions
    SET title = ${title},
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return row ? toSession(row) : null;
}

export async function updateSessionState(
  sql: Sql,
  id: string,
  state: SessionState,
  agentId?: string | null,
): Promise<Session | null> {
  const [row] = await sql<SessionRow[]>`
    UPDATE sessions
    SET state = ${state},
        agent_id = ${agentId !== undefined ? agentId : sql`agent_id`},
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return row ? toSession(row) : null;
}

export async function createMessage(
  sql: Sql,
  sessionId: string,
  role: MessageRole,
  content: string,
  thinking?: string | null,
  opts?: {
    id?: string;
    toolName?: string | null;
    toolArgs?: Record<string, unknown> | null;
    toolCallId?: string | null;
    approvalStatus?: ApprovalStatus | null;
  },
): Promise<Message> {
  const id = opts?.id ?? undefined;
  const toolName = opts?.toolName ?? null;
  const toolArgs = opts?.toolArgs ?? null;
  const toolCallId = opts?.toolCallId ?? null;
  const approvalStatus = opts?.approvalStatus ?? null;
  const tokenCount = estimateTokens(content + (thinking ?? ""));

  const [row] = id
    ? await sql<MessageRow[]>`
        INSERT INTO messages (id, session_id, role, content, thinking, tool_name, tool_args, tool_call_id, approval_status, token_count)
        VALUES (${id}, ${sessionId}, ${role}, ${content}, ${thinking ?? null}, ${toolName}, ${toolArgs ? sql.json(toolArgs) : null}, ${toolCallId}, ${approvalStatus}, ${tokenCount})
        RETURNING *
      `
    : await sql<MessageRow[]>`
        INSERT INTO messages (session_id, role, content, thinking, tool_name, tool_args, tool_call_id, approval_status, token_count)
        VALUES (${sessionId}, ${role}, ${content}, ${thinking ?? null}, ${toolName}, ${toolArgs ? sql.json(toolArgs) : null}, ${toolCallId}, ${approvalStatus}, ${tokenCount})
        RETURNING *
      `;
  return toMessage(row);
}

export async function getMessages(
  sql: Sql,
  sessionId: string,
): Promise<Message[]> {
  const rows = await sql<MessageRow[]>`
    SELECT * FROM messages WHERE session_id = ${sessionId} ORDER BY created_at ASC
  `;
  return rows.map(toMessage);
}

export async function getMessageById(
  sql: Sql,
  id: string,
): Promise<Message | null> {
  const [row] = await sql<MessageRow[]>`
    SELECT * FROM messages WHERE id = ${id}
  `;
  return row ? toMessage(row) : null;
}

export async function getMessageByToolCallId(
  sql: Sql,
  toolCallId: string,
): Promise<Message | null> {
  const [row] = await sql<MessageRow[]>`
    SELECT * FROM messages WHERE tool_call_id = ${toolCallId} AND role = 'tool_call'
  `;
  return row ? toMessage(row) : null;
}

export async function updateApprovalStatus(
  sql: Sql,
  messageId: string,
  approvalStatus: ApprovalStatus,
): Promise<Message | null> {
  const [row] = await sql<MessageRow[]>`
    UPDATE messages SET approval_status = ${approvalStatus} WHERE id = ${messageId} RETURNING *
  `;
  return row ? toMessage(row) : null;
}

// --- Token estimation ---

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// --- Context management ---

export async function updateContextStatus(
  sql: Sql,
  messageId: string,
  contextStatus: ContextStatus,
): Promise<Message | null> {
  const [row] = await sql<MessageRow[]>`
    UPDATE messages SET context_status = ${contextStatus} WHERE id = ${messageId} RETURNING *
  `;
  return row ? toMessage(row) : null;
}

export async function getActiveMessages(
  sql: Sql,
  sessionId: string,
): Promise<{ messages: Message[]; summaries: Summary[] }> {
  const messageRows = await sql<MessageRow[]>`
    SELECT * FROM messages
    WHERE session_id = ${sessionId} AND context_status = 'active'
    ORDER BY created_at ASC
  `;

  const summaryRows = await sql<(SummaryRow & { message_ids: string[] })[]>`
    SELECT s.*, ARRAY_AGG(sm.message_id) AS message_ids
    FROM summaries s
    JOIN summary_messages sm ON sm.summary_id = s.id
    WHERE s.session_id = ${sessionId}
    GROUP BY s.id
    ORDER BY s.position_at ASC
  `;

  return {
    messages: messageRows.map(toMessage),
    summaries: summaryRows.map(toSummary),
  };
}

function toSummary(row: SummaryRow & { message_ids: string[] }): Summary {
  return {
    id: row.id,
    sessionId: row.session_id,
    content: row.content,
    tokenCount: row.token_count,
    createdBy: row.created_by,
    messageIds: row.message_ids,
    positionAt: row.position_at,
    createdAt: row.created_at,
  };
}

export async function createSummary(
  sql: Sql,
  sessionId: string,
  content: string,
  createdBy: "agent" | "user",
  messageIds: string[],
): Promise<Summary> {
  return await sql.begin(async (tx) => {
    // Validate: all messages must be active
    const targets = await tx<MessageRow[]>`
      SELECT * FROM messages WHERE id = ANY(${messageIds}) AND session_id = ${sessionId}
    `;

    if (targets.length !== messageIds.length) {
      throw new Error("Some message IDs not found in this session");
    }

    for (const msg of targets) {
      if (msg.context_status !== "active") {
        throw new Error(`Message ${msg.id} is not active (status: ${msg.context_status})`);
      }
    }

    // Find earliest created_at for position_at
    const earliest = targets.reduce((min, m) =>
      m.created_at < min.created_at ? m : min,
    );

    const tokenCount = estimateTokens(content);

    const [summaryRow] = await tx<SummaryRow[]>`
      INSERT INTO summaries (session_id, content, token_count, created_by, position_at)
      VALUES (${sessionId}, ${content}, ${tokenCount}, ${createdBy}, ${earliest.created_at})
      RETURNING *
    `;

    // Create join table entries
    for (const msgId of messageIds) {
      await tx`INSERT INTO summary_messages (summary_id, message_id) VALUES (${summaryRow.id}, ${msgId})`;
    }

    // Set messages to summarized
    await tx`UPDATE messages SET context_status = 'summarized' WHERE id = ANY(${messageIds})`;

    return {
      id: summaryRow.id,
      sessionId: summaryRow.session_id,
      content: summaryRow.content,
      tokenCount: summaryRow.token_count,
      createdBy: summaryRow.created_by,
      messageIds,
      positionAt: summaryRow.position_at,
      createdAt: summaryRow.created_at,
    };
  });
}

export async function deleteSummary(
  sql: Sql,
  summaryId: string,
): Promise<{ restoredMessageIds: string[] } | null> {
  return await sql.begin(async (tx) => {
    // Get the message IDs from the join table
    const joinRows = await tx<{ message_id: string }[]>`
      SELECT message_id FROM summary_messages WHERE summary_id = ${summaryId}
    `;

    if (joinRows.length === 0) return null;

    const messageIds = joinRows.map((r) => r.message_id);

    // Restore messages to active
    await tx`UPDATE messages SET context_status = 'active' WHERE id = ANY(${messageIds})`;

    // Delete join table entries and summary
    await tx`DELETE FROM summary_messages WHERE summary_id = ${summaryId}`;
    await tx`DELETE FROM summaries WHERE id = ${summaryId}`;

    return { restoredMessageIds: messageIds };
  });
}

export async function getSummariesForSession(
  sql: Sql,
  sessionId: string,
): Promise<Summary[]> {
  const rows = await sql<(SummaryRow & { message_ids: string[] })[]>`
    SELECT s.*, ARRAY_AGG(sm.message_id) AS message_ids
    FROM summaries s
    JOIN summary_messages sm ON sm.summary_id = s.id
    WHERE s.session_id = ${sessionId}
    GROUP BY s.id
    ORDER BY s.position_at ASC
  `;
  return rows.map(toSummary);
}

export async function getContextStatus(
  sql: Sql,
  sessionId: string,
): Promise<{ messages: Array<{ id: string; contextStatus: ContextStatus; tokenCount: number | null }>; usedTokens: number }> {
  const rows = await sql<{ id: string; context_status: ContextStatus; token_count: number | null }[]>`
    SELECT id, context_status, token_count FROM messages WHERE session_id = ${sessionId} ORDER BY created_at ASC
  `;

  const messages = rows.map((r) => ({
    id: r.id,
    contextStatus: r.context_status,
    tokenCount: r.token_count,
  }));

  const usedTokens = rows
    .filter((r) => r.context_status === "active")
    .reduce((sum, r) => sum + (r.token_count ?? 0), 0);

  return { messages, usedTokens };
}
