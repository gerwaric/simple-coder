import type { Sql } from "postgres";
import type { Session, Message, SessionState, MessageRole } from "@simple-coder/shared";

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
): Promise<Message> {
  const [row] = await sql<MessageRow[]>`
    INSERT INTO messages (session_id, role, content, thinking)
    VALUES (${sessionId}, ${role}, ${content}, ${thinking ?? null})
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
