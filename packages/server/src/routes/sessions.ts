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
} from "../db/queries.js";
import { broadcastToUi, getAgentBySessionId, sendToAgent } from "../ws/connections.js";
import { dispatchPendingSessions } from "../ws/dispatch.js";

export function sessionRoutes(sql: Sql): Hono {
  const app = new Hono();

  // Create session + first user message
  app.post("/", async (c) => {
    const body = await c.req.json<{ title?: string; message: string }>();
    if (!body.message) {
      return c.json({ error: "message is required" }, 400);
    }

    const session = await createSession(sql, body.title || "");
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

  // Get session + messages
  app.get("/:id", async (c) => {
    const id = c.req.param("id");
    const session = await getSession(sql, id);
    if (!session) return c.json({ error: "not found" }, 404);

    const messages = await getMessages(sql, id);
    return c.json({ session, messages });
  });

  // Send user message to active session
  app.post("/:id/messages", async (c) => {
    const id = c.req.param("id");
    const session = await getSession(sql, id);
    if (!session) return c.json({ error: "not found" }, 404);
    if (session.state !== SessionState.Active) {
      return c.json({ error: "session is not active" }, 400);
    }

    const body = await c.req.json<{ message: string }>();
    if (!body.message) return c.json({ error: "message is required" }, 400);

    const message = await createMessage(sql, id, MessageRole.User, body.message);
    broadcastToUi({ type: "message:created", message });

    // Relay to assigned agent
    const agent = getAgentBySessionId(id);
    if (agent) {
      const [agentId] = agent;
      sendToAgent(agentId, { type: "user:message", message });
    }

    return c.json({ message }, 201);
  });

  // Stop session
  app.post("/:id/stop", async (c) => {
    const id = c.req.param("id");
    const session = await getSession(sql, id);
    if (!session) return c.json({ error: "not found" }, 404);

    const updated = await updateSessionState(sql, id, SessionState.Stopped);
    if (updated) broadcastToUi({ type: "session:updated", updated });

    // Notify agent
    const agent = getAgentBySessionId(id);
    if (agent) {
      const [agentId] = agent;
      sendToAgent(agentId, { type: "session:stop", sessionId: id });
    }

    return c.json({ session: updated });
  });

  return app;
}
