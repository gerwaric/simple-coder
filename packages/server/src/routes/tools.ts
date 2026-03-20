import { Hono } from "hono";
import type { Sql } from "postgres";
import { ApprovalStatus } from "@simple-coder/shared";
import { getMessageByToolCallId, updateApprovalStatus } from "../db/queries.js";
import { broadcastToUi, getAgentBySessionId, sendToAgent } from "../ws/connections.js";

export function toolRoutes(sql: Sql): Hono {
  const app = new Hono();

  // Approve a pending tool call
  app.post("/:toolCallId/approve", async (c) => {
    const toolCallId = c.req.param("toolCallId");
    const msg = await getMessageByToolCallId(sql, toolCallId);
    if (!msg) return c.json({ error: "tool call not found" }, 404);
    if (msg.approvalStatus !== ApprovalStatus.Pending) {
      return c.json({ error: `tool call is already ${msg.approvalStatus}` }, 400);
    }

    await updateApprovalStatus(sql, msg.id, ApprovalStatus.Approved);

    // Send approval response to agent
    const agent = getAgentBySessionId(msg.sessionId);
    if (agent) {
      const [agentId] = agent;
      sendToAgent(agentId, {
        type: "tool:approval:response",
        toolCallId,
        approved: true,
      });
    }

    // Broadcast update to UI
    broadcastToUi({
      type: "message:complete",
      message: { ...msg, approvalStatus: ApprovalStatus.Approved },
    });

    return c.json({ ok: true });
  });

  // Reject a pending tool call
  app.post("/:toolCallId/reject", async (c) => {
    const toolCallId = c.req.param("toolCallId");
    const msg = await getMessageByToolCallId(sql, toolCallId);
    if (!msg) return c.json({ error: "tool call not found" }, 404);
    if (msg.approvalStatus !== ApprovalStatus.Pending) {
      return c.json({ error: `tool call is already ${msg.approvalStatus}` }, 400);
    }

    await updateApprovalStatus(sql, msg.id, ApprovalStatus.Rejected);

    // Send rejection to agent
    const agent = getAgentBySessionId(msg.sessionId);
    if (agent) {
      const [agentId] = agent;
      sendToAgent(agentId, {
        type: "tool:approval:response",
        toolCallId,
        approved: false,
      });
    }

    // Broadcast update to UI
    broadcastToUi({
      type: "message:complete",
      message: { ...msg, approvalStatus: ApprovalStatus.Rejected },
    });

    return c.json({ ok: true });
  });

  // Respond to ask_human tool call
  app.post("/:toolCallId/respond", async (c) => {
    const toolCallId = c.req.param("toolCallId");
    const body = await c.req.json<{ response: string }>();
    if (!body.response) {
      return c.json({ error: "response is required" }, 400);
    }

    const msg = await getMessageByToolCallId(sql, toolCallId);
    if (!msg) return c.json({ error: "tool call not found" }, 404);
    if (msg.approvalStatus !== ApprovalStatus.Pending) {
      return c.json({ error: `tool call is already ${msg.approvalStatus}` }, 400);
    }

    await updateApprovalStatus(sql, msg.id, ApprovalStatus.Approved);

    // Send response text to agent
    const agent = getAgentBySessionId(msg.sessionId);
    if (agent) {
      const [agentId] = agent;
      sendToAgent(agentId, {
        type: "tool:approval:response",
        toolCallId,
        approved: true,
        response: body.response,
      });
    }

    // Broadcast update to UI
    broadcastToUi({
      type: "message:complete",
      message: { ...msg, approvalStatus: ApprovalStatus.Approved },
    });

    return c.json({ ok: true });
  });

  return app;
}
