import { Hono } from "hono";
import type { Sql } from "postgres";
import { ContextStatus } from "@simple-coder/shared";
import {
  getMessageById,
  updateContextStatus,
  createSummary,
  deleteSummary,
  getContextStatus,
  getSummariesForSession,
  getSession,
} from "../db/queries.js";
import {
  broadcastContextUpdated,
  broadcastSummaryCreated,
  broadcastSummaryDeleted,
  broadcastContextStatus,
} from "../ws/connections.js";

const LLM_MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS) || 128000;

export function contextRoutes(sql: Sql): Hono {
  const app = new Hono();

  // PATCH /api/messages/:id/context-status
  app.patch("/:id/context-status", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json<{ status: string }>();

    if (body.status !== "active" && body.status !== "inactive") {
      return c.json({ error: "status must be 'active' or 'inactive'" }, 400);
    }

    const msg = await getMessageById(sql, id);
    if (!msg) return c.json({ error: "message not found" }, 404);

    // If restoring a summarized message, delete the associated summary
    if (body.status === "active" && msg.contextStatus === ContextStatus.Summarized) {
      // Find the summary that contains this message
      const summaries = await getSummariesForSession(sql, msg.sessionId);
      const summary = summaries.find((s) => s.messageIds.includes(id));
      if (summary) {
        const result = await deleteSummary(sql, summary.id);
        if (result) {
          broadcastSummaryDeleted(msg.sessionId, summary.id, result.restoredMessageIds);
        }
      }
    } else {
      await updateContextStatus(sql, id, body.status as ContextStatus);
      broadcastContextUpdated(msg.sessionId, [id], body.status as ContextStatus);
    }

    // Broadcast updated token counts
    const status = await getContextStatus(sql, msg.sessionId);
    broadcastContextStatus(msg.sessionId, status.usedTokens, LLM_MAX_TOKENS);

    return c.json({ ok: true });
  });

  return app;
}

export function summaryRoutes(sql: Sql): Hono {
  const app = new Hono();

  // POST /api/sessions/:id/summaries — mounted under session routes
  // This is actually called from sessionRoutes, so we export a handler instead
  return app;
}

export function createSummaryRoutes(sql: Sql): Hono {
  const app = new Hono();

  // DELETE /api/summaries/:id
  app.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const result = await deleteSummary(sql, id);
    if (!result) return c.json({ error: "summary not found" }, 404);

    // We need the sessionId — get it from one of the restored messages
    const msg = await getMessageById(sql, result.restoredMessageIds[0]);
    if (msg) {
      broadcastSummaryDeleted(msg.sessionId, id, result.restoredMessageIds);
      const status = await getContextStatus(sql, msg.sessionId);
      broadcastContextStatus(msg.sessionId, status.usedTokens, LLM_MAX_TOKENS);
    }

    return c.json({ ok: true });
  });

  return app;
}
