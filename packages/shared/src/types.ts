import type { SessionState, MessageRole, ApprovalStatus, ContextStatus } from "./constants.js";

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
  toolName: string | null;
  toolArgs: Record<string, unknown> | null;
  toolCallId: string | null;
  approvalStatus: ApprovalStatus | null;
  contextStatus: ContextStatus;
  tokenCount: number | null;
  createdAt: string;
}

export interface Summary {
  id: string;
  sessionId: string;
  content: string;
  tokenCount: number | null;
  createdBy: "agent" | "user";
  messageIds: string[];
  positionAt: string;
  createdAt: string;
}
