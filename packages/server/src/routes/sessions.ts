import { Hono } from "hono";
import type { Sql } from "postgres";
import { SessionState, MessageRole } from "@simple-coder/shared";
import {
  createSession,
  getSession,
  listSessions,
  createMessage,
  getMessages,
  updateSessionState,
  updateSessionTitle,
  deleteSession,
  createSummary,
  getSummariesForSession,
  getContextStatus,
} from "../db/queries.js";
import {
  broadcastToUi,
  getAgentBySessionId,
  sendToAgent,
  broadcastSummaryCreated,
  broadcastContextStatus,
} from "../ws/connections.js";
import { dispatchPendingSessions } from "../ws/dispatch.js";
import { getTokenBudget } from "../settings.js";

export function sessionRoutes(sql: Sql): Hono {
  const app = new Hono();

  // Create session + first user message
  app.post("/", async (c) => {
    const body = await c.req.json<{ title?: string; message: string; includeClaudeMd?: boolean }>();
    if (!body.message) {
      return c.json({ error: "message is required" }, 400);
    }

    const session = await createSession(sql, body.title || "", body.includeClaudeMd ?? false);
    const message = await createMessage(sql, session.id, MessageRole.User, body.message);

    broadcastToUi({ type: "session:updated", session });
    broadcastToUi({ type: "message:created", message });

    // Try to dispatch immediately
    await dispatchPendingSessions(sql);

    return c.json({ session, message }, 201);
  });

  // List all sessions
  app.get("/", async (c) => {
    const sessions = await listSessions(sql);
    return c.json(sessions);
  });

  // Get session + messages + summaries
  app.get("/:id", async (c) => {
    const id = c.req.param("id");
    const session = await getSession(sql, id);
    if (!session) return c.json({ error: "not found" }, 404);

    const messages = await getMessages(sql, id);
    const summaries = await getSummariesForSession(sql, id);
    return c.json({ session, messages, summaries });
  });

  // Update session title
  app.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json<{ title: string }>();
    if (body.title == null) return c.json({ error: "title is required" }, 400);

    const session = await updateSessionTitle(sql, id, body.title);
    if (!session) return c.json({ error: "not found" }, 404);

    broadcastToUi({ type: "session:updated", session });
    return c.json({ session });
  });

  // Get context status (token counts)
  app.get("/:id/context", async (c) => {
    const id = c.req.param("id");
    const session = await getSession(sql, id);
    if (!session) return c.json({ error: "not found" }, 404);

    const status = await getContextStatus(sql, id);
    return c.json({ ...status, maxTokens: getTokenBudget() });
  });

  // Create summary
  app.post("/:id/summaries", async (c) => {
    const id = c.req.param("id");
    const session = await getSession(sql, id);
    if (!session) return c.json({ error: "not found" }, 404);

    const body = await c.req.json<{ content: string; messageIds: string[]; createdBy: "agent" | "user" }>();
    if (!body.content || !body.messageIds?.length || !body.createdBy) {
      return c.json({ error: "content, messageIds, and createdBy are required" }, 400);
    }

    try {
      const summary = await createSummary(sql, id, body.content, body.createdBy, body.messageIds);
      broadcastSummaryCreated(id, summary);
      const status = await getContextStatus(sql, id);
      broadcastContextStatus(id, status.usedTokens, getTokenBudget());
      return c.json({ summary }, 201);
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  // Send user message to active session
  app.post("/:id/messages", async (c) => {
    const id = c.req.param("id");
    const session = await getSession(sql, id);
    if (!session) return c.json({ error: "not found" }, 404);
    if (session.state !== SessionState.Active && session.state !== SessionState.Pending) {
      return c.json({ error: "session is not active" }, 400);
    }

    const body = await c.req.json<{ message: string }>();
    if (!body.message) return c.json({ error: "message is required" }, 400);

    const message = await createMessage(sql, id, MessageRole.User, body.message);
    broadcastToUi({ type: "message:created", message });

    // Relay to assigned agent, or re-dispatch if agent was released
    const agent = getAgentBySessionId(id);
    if (agent) {
      const [agentId] = agent;
      sendToAgent(agentId, { type: "user:message", message });
    } else {
      // Agent was released after turn:complete — set session to pending for re-dispatch
      await updateSessionState(sql, id, SessionState.Pending, null);
      await dispatchPendingSessions(sql);
    }

    return c.json({ message }, 201);
  });

  // Stop session
  app.post("/:id/stop", async (c) => {
    const id = c.req.param("id");
    const session = await getSession(sql, id);
    if (!session) return c.json({ error: "not found" }, 404);

    const updated = await updateSessionState(sql, id, SessionState.Stopped);
    if (updated) broadcastToUi({ type: "session:updated", session: updated });

    // Notify agent
    const agent = getAgentBySessionId(id);
    if (agent) {
      const [agentId] = agent;
      sendToAgent(agentId, { type: "session:stop", sessionId: id });
    }

    return c.json({ session: updated });
  });

  // Restart stopped session
  app.post("/:id/restart", async (c) => {
    const id = c.req.param("id");
    const session = await getSession(sql, id);
    if (!session) return c.json({ error: "not found" }, 404);
    if (session.state !== SessionState.Stopped && session.state !== SessionState.Completed) {
      return c.json({ error: "session is not stopped or completed" }, 400);
    }

    const updated = await updateSessionState(sql, id, SessionState.Pending, null);
    if (updated) broadcastToUi({ type: "session:updated", session: updated });

    await dispatchPendingSessions(sql);
    return c.json({ session: updated });
  });

  // Delete session
  app.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const session = await getSession(sql, id);
    if (!session) return c.json({ error: "not found" }, 404);

    // Stop agent if active
    const agent = getAgentBySessionId(id);
    if (agent) {
      const [agentId] = agent;
      sendToAgent(agentId, { type: "session:stop", sessionId: id });
    }

    const deleted = await deleteSession(sql, id);
    if (deleted) broadcastToUi({ type: "session:deleted", sessionId: id });

    return c.json({ success: true });
  });

  return app;
}
