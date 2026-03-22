import type { WSContext } from "hono/ws";
import type { ServerToUI, Summary } from "@simple-coder/shared";
import type { ContextStatus } from "@simple-coder/shared";

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

/**
 * Reserve an idle agent by setting a sentinel session ID.
 * Returns the agentId if reservation succeeded, undefined if no idle agent.
 * This prevents concurrent dispatches from grabbing the same agent.
 */
const RESERVING_SENTINEL = "__reserving__";

export function reserveIdleAgent(): string | undefined {
  for (const [id, conn] of agents) {
    if (conn.currentSessionId === null) {
      conn.currentSessionId = RESERVING_SENTINEL;
      return id;
    }
  }
  return undefined;
}

export function unreserveAgent(agentId: string): void {
  const agent = agents.get(agentId);
  if (agent && agent.currentSessionId === RESERVING_SENTINEL) {
    agent.currentSessionId = null;
  }
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

// --- Context broadcasting helpers ---

export function broadcastContextUpdated(sessionId: string, messageIds: string[], contextStatus: ContextStatus): void {
  const msg = { type: "context:updated" as const, sessionId, messageIds, contextStatus };
  const data = JSON.stringify(msg);

  // Send to agent assigned to this session
  const agent = getAgentBySessionId(sessionId);
  if (agent) {
    const [, conn] = agent;
    conn.ws.send(data);
  }

  // Send to UI
  broadcastToUi(msg);
}

export function broadcastSummaryCreated(sessionId: string, summary: Summary): void {
  const msg = { type: "summary:created" as const, sessionId, summary };
  const data = JSON.stringify(msg);

  const agent = getAgentBySessionId(sessionId);
  if (agent) {
    const [, conn] = agent;
    conn.ws.send(data);
  }

  broadcastToUi(msg);
}

export function broadcastSummaryDeleted(sessionId: string, summaryId: string, restoredMessageIds: string[]): void {
  const msg = { type: "summary:deleted" as const, sessionId, summaryId, restoredMessageIds };
  const data = JSON.stringify(msg);

  const agent = getAgentBySessionId(sessionId);
  if (agent) {
    const [, conn] = agent;
    conn.ws.send(data);
  }

  broadcastToUi(msg);
}

export function broadcastContextStatus(sessionId: string, usedTokens: number, maxTokens: number): void {
  broadcastToUi({
    type: "context:status",
    sessionId,
    usedTokens,
    maxTokens,
  });
}

export function resetConnections(): void {
  agents.clear();
  uiClients.clear();
}
