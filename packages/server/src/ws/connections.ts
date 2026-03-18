import type { WSContext } from "hono/ws";
import type { ServerToUI } from "@simple-coder/shared";

interface AgentConnection {
  ws: WSContext;
  currentSessionId: string | null;
}

const agents = new Map<string, AgentConnection>();
const uiClients = new Set<WSContext>();

export function registerAgent(agentId: string, ws: WSContext): void {
  agents.set(agentId, { ws, currentSessionId: null });
}

export function removeAgent(agentId: string): string | null {
  const agent = agents.get(agentId);
  const sessionId = agent?.currentSessionId ?? null;
  agents.delete(agentId);
  return sessionId;
}

export function getAgent(agentId: string): AgentConnection | undefined {
  return agents.get(agentId);
}

export function assignSessionToAgent(agentId: string, sessionId: string): void {
  const agent = agents.get(agentId);
  if (agent) agent.currentSessionId = sessionId;
}

export function clearAgentSession(agentId: string): void {
  const agent = agents.get(agentId);
  if (agent) agent.currentSessionId = null;
}

export function getIdleAgent(): [string, AgentConnection] | undefined {
  for (const [id, conn] of agents) {
    if (conn.currentSessionId === null) return [id, conn];
  }
  return undefined;
}

export function getAgentBySessionId(sessionId: string): [string, AgentConnection] | undefined {
  for (const [id, conn] of agents) {
    if (conn.currentSessionId === sessionId) return [id, conn];
  }
  return undefined;
}

export function addUiClient(ws: WSContext): void {
  uiClients.add(ws);
}

export function removeUiClient(ws: WSContext): void {
  uiClients.delete(ws);
}

export function broadcastToUi(message: ServerToUI): void {
  const data = JSON.stringify(message);
  for (const ws of uiClients) {
    ws.send(data);
  }
}

export function sendToAgent(agentId: string, message: unknown): void {
  const agent = agents.get(agentId);
  if (agent) agent.ws.send(JSON.stringify(message));
}
