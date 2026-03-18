import { randomUUID } from "node:crypto";
import { AgentConnection } from "./connection.js";

const agentId = process.env.AGENT_ID || `agent-${randomUUID().slice(0, 8)}`;
const serverUrl = process.env.SERVER_WS_URL || "ws://localhost:3000/ws/agent";
const secret = process.env.AGENT_SECRET || "change-me";

console.log(`simple-coder agent starting (id: ${agentId})`);

const agent = new AgentConnection(agentId, serverUrl, secret);
agent.start();
