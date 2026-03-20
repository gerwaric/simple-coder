import type { Sql } from "postgres";
import type { WSContext, WSMessageReceive } from "hono/ws";
import { SessionState, MessageRole, ApprovalStatus } from "@simple-coder/shared";
import type { AgentToServer } from "@simple-coder/shared";
import { createMessage, updateSessionState } from "../db/queries.js";
import {
  registerAgent,
  removeAgent,
  clearAgentSession,
  broadcastToUi,
} from "./connections.js";
import { dispatchPendingSessions } from "./dispatch.js";

const AGENT_SECRET = process.env.AGENT_SECRET || "change-me";

export function createAgentWsHandlers(sql: Sql) {
  let agentId: string | null = null;

  return {
    onMessage(evt: MessageEvent<WSMessageReceive>, ws: WSContext) {
      let msg: AgentToServer;
      try {
        msg = JSON.parse(typeof evt.data === "string" ? evt.data : new TextDecoder().decode(evt.data as ArrayBuffer));
      } catch {
        return;
      }

      handleMessage(sql, ws, msg).catch(console.error);
    },

    onClose(_evt: CloseEvent, _ws: WSContext) {
      handleClose(sql).catch(console.error);
    },
  };

  async function handleMessage(sql: Sql, ws: WSContext, msg: AgentToServer) {
    if (msg.type === "agent:register") {
      if (msg.secret !== AGENT_SECRET) {
        ws.send(JSON.stringify({ type: "error", message: "invalid secret" }));
        ws.close(4001, "unauthorized");
        return;
      }
      agentId = msg.agentId;
      registerAgent(agentId, ws);
      ws.send(JSON.stringify({ type: "agent:registered" }));
      return;
    }

    if (!agentId) {
      ws.send(JSON.stringify({ type: "error", message: "not registered" }));
      return;
    }

    switch (msg.type) {
      case "agent:ready": {
        await dispatchPendingSessions(sql);
        break;
      }

      case "thinking:token": {
        broadcastToUi({
          type: "thinking:stream",
          sessionId: msg.sessionId,
          token: msg.token,
        });
        break;
      }

      case "thinking:complete": {
        break;
      }

      case "assistant:token": {
        broadcastToUi({
          type: "token:stream",
          sessionId: msg.sessionId,
          token: msg.token,
        });
        break;
      }

      case "assistant:message:complete": {
        const message = await createMessage(
          sql,
          msg.sessionId,
          MessageRole.Assistant,
          msg.content,
          msg.thinking,
        );
        broadcastToUi({ type: "message:complete", message });
        break;
      }

      case "session:completed": {
        const session = await updateSessionState(sql, msg.sessionId, SessionState.Completed);
        clearAgentSession(agentId);
        if (session) broadcastToUi({ type: "session:updated", session });
        await dispatchPendingSessions(sql);
        break;
      }

      case "tool:call": {
        await createMessage(
          sql,
          msg.sessionId,
          MessageRole.ToolCall,
          "",
          null,
          {
            toolName: msg.toolName,
            toolArgs: msg.args,
            toolCallId: msg.toolCallId,
          },
        );
        broadcastToUi({
          type: "tool:call",
          sessionId: msg.sessionId,
          toolCallId: msg.toolCallId,
          toolName: msg.toolName,
          args: msg.args,
        });
        break;
      }

      case "tool:result": {
        await createMessage(
          sql,
          msg.sessionId,
          MessageRole.ToolResult,
          typeof msg.result === "string" ? msg.result : JSON.stringify(msg.result),
          null,
          {
            toolName: msg.toolName,
            toolCallId: msg.toolCallId,
          },
        );
        broadcastToUi({
          type: "tool:result",
          sessionId: msg.sessionId,
          toolCallId: msg.toolCallId,
          toolName: msg.toolName,
          result: msg.result,
        });
        break;
      }

      case "turn:complete": {
        clearAgentSession(agentId);
        await dispatchPendingSessions(sql);
        break;
      }

      case "tool:approval:request": {
        await createMessage(
          sql,
          msg.sessionId,
          MessageRole.ToolCall,
          "",
          null,
          {
            toolName: msg.toolName,
            toolArgs: msg.args,
            toolCallId: msg.toolCallId,
            approvalStatus: ApprovalStatus.Pending,
          },
        );
        broadcastToUi({
          type: "tool:approval:request",
          sessionId: msg.sessionId,
          toolCallId: msg.toolCallId,
          toolName: msg.toolName,
          args: msg.args,
        });
        break;
      }
    }
  }

  async function handleClose(sql: Sql) {
    if (agentId) {
      const sessionId = removeAgent(agentId);
      if (sessionId) {
        const session = await updateSessionState(sql, sessionId, SessionState.Pending, null);
        if (session) broadcastToUi({ type: "session:updated", session });
      }
    }
  }
}
