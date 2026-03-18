import type { SessionState, MessageRole } from "./constants.js";

export interface Session {
  id: string;
  state: SessionState;
  agentId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  thinking: string | null;
  createdAt: string;
}
