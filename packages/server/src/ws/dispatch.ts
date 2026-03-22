import type { Sql } from "postgres";
import { SessionState } from "@simple-coder/shared";
import type { SessionAssign } from "@simple-coder/shared";
import { getSession, getMessages, updateSessionState } from "../db/queries.js";
import { reserveIdleAgent, unreserveAgent, assignSessionToAgent, sendToAgent, broadcastToUi } from "./connections.js";

export async function dispatchPendingSessions(sql: Sql): Promise<void> {
  // Reserve an idle agent in-memory first to prevent concurrent dispatches
  // from grabbing the same agent
  const agentId = reserveIdleAgent();
  if (!agentId) return;

  try {
    // Atomically claim the oldest pending session using FOR UPDATE SKIP LOCKED
    // so concurrent dispatches don't fight over the same row
    const [row] = await sql<{ id: string }[]>`
      SELECT id FROM sessions
      WHERE state = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;
    if (!row) {
      unreserveAgent(agentId);
      return;
    }

    await dispatchSession(sql, row.id, agentId);
  } catch (err) {
    unreserveAgent(agentId);
    throw err;
  }
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
