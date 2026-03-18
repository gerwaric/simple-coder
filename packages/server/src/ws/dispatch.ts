import type { Sql } from "postgres";
import { SessionState } from "@simple-coder/shared";
import type { SessionAssign } from "@simple-coder/shared";
import { getSession, getMessages, updateSessionState } from "../db/queries.js";
import { getIdleAgent, assignSessionToAgent, sendToAgent, broadcastToUi } from "./connections.js";

export async function dispatchPendingSessions(sql: Sql): Promise<void> {
  const idle = getIdleAgent();
  if (!idle) return;

  const [agentId] = idle;

  // Find the oldest pending session
  const [row] = await sql<{ id: string }[]>`
    SELECT id FROM sessions WHERE state = 'pending' ORDER BY created_at ASC LIMIT 1
  `;
  if (!row) return;

  await dispatchSession(sql, row.id, agentId);
}

export async function dispatchSession(sql: Sql, sessionId: string, agentId: string): Promise<void> {
  const session = await updateSessionState(sql, sessionId, SessionState.Active, agentId);
  if (!session) return;

  const messages = await getMessages(sql, sessionId);

  assignSessionToAgent(agentId, sessionId);

  const assignMsg: SessionAssign = {
    type: "session:assign",
    session,
    messages,
  };
  sendToAgent(agentId, assignMsg);

  broadcastToUi({ type: "session:updated", session });
}
