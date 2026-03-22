import { config } from "dotenv";
config({ path: new URL("../../../.env", import.meta.url).pathname });
import { randomUUID } from "node:crypto";
import { AgentConnection } from "./connection.js";

// Validate required environment variables
if (!process.env.LLM_API_KEY) {
  console.error("FATAL: LLM_API_KEY environment variable is required");
  process.exit(1);
}
if (!process.env.AGENT_SECRET) {
  console.warn("WARNING: AGENT_SECRET not set, using default — set this in production");
}

const agentId = process.env.AGENT_ID || `agent-${randomUUID().slice(0, 8)}`;
const serverUrl = process.env.SERVER_WS_URL || "ws://localhost:3000/ws/agent";
const secret = process.env.AGENT_SECRET || "change-me";

console.log(`simple-coder agent starting (id: ${agentId})`);

const agent = new AgentConnection(agentId, serverUrl, secret);
agent.start();
