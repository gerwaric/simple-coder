import type { Session, Message, Summary } from "./types.js";
import type { ContextStatus } from "./constants.js";

// --- Agent ↔ Server messages ---

export interface AgentRegister {
  type: "agent:register";
  agentId: string;
  secret: string;
}

export interface AgentReady {
  type: "agent:ready";
}

export interface SessionAssign {
  type: "session:assign";
  session: Session;
  messages: Message[];
}

export interface UserMessage {
  type: "user:message";
  message: Message;
}

export interface ThinkingToken {
  type: "thinking:token";
  sessionId: string;
  token: string;
}

export interface ThinkingComplete {
  type: "thinking:complete";
  sessionId: string;
  thinking: string;
}

export interface AssistantToken {
  type: "assistant:token";
  sessionId: string;
  token: string;
}

export interface AssistantMessageComplete {
  type: "assistant:message:complete";
  sessionId: string;
  content: string;
  thinking: string | null;
}

export interface ToolCall {
  type: "tool:call";
  sessionId: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  type: "tool:result";
  sessionId: string;
  toolCallId: string;
  toolName: string;
  result: unknown;
}

export interface ToolApprovalRequest {
  type: "tool:approval:request";
  sessionId: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolApprovalResponse {
  type: "tool:approval:response";
  toolCallId: string;
  approved: boolean;
  response?: string;
}

export interface SessionStop {
  type: "session:stop";
  sessionId: string;
}

export interface SessionCompleted {
  type: "session:completed";
  sessionId: string;
}

// --- Context management messages (Server → Agent + UI) ---

export interface ContextUpdated {
  type: "context:updated";
  sessionId: string;
  messageIds: string[];
  contextStatus: ContextStatus;
}

export interface SummaryCreated {
  type: "summary:created";
  sessionId: string;
  summary: Summary;
}

export interface SummaryDeleted {
  type: "summary:deleted";
  sessionId: string;
  summaryId: string;
  restoredMessageIds: string[];
}

export type AgentToServer =
  | AgentRegister
  | AgentReady
  | ThinkingToken
  | ThinkingComplete
  | AssistantToken
  | AssistantMessageComplete
  | ToolCall
  | ToolResult
  | ToolApprovalRequest
  | SessionCompleted;

export type ServerToAgent =
  | SessionAssign
  | UserMessage
  | ToolApprovalResponse
  | ContextUpdated
  | SummaryCreated
  | SummaryDeleted
  | SessionStop;

export type AgentServerMessage = AgentToServer | ServerToAgent;

// --- Server → UI messages ---

export interface SessionUpdated {
  type: "session:updated";
  session: Session;
}

export interface MessageCreated {
  type: "message:created";
  message: Message;
}

export interface ThinkingStream {
  type: "thinking:stream";
  sessionId: string;
  token: string;
}

export interface TokenStream {
  type: "token:stream";
  sessionId: string;
  token: string;
}

export interface MessageComplete {
  type: "message:complete";
  message: Message;
}

export interface UIToolCall {
  type: "tool:call";
  sessionId: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface UIToolResult {
  type: "tool:result";
  sessionId: string;
  toolCallId: string;
  toolName: string;
  result: unknown;
}

export interface UIToolApprovalRequest {
  type: "tool:approval:request";
  sessionId: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface UIContextUpdated {
  type: "context:updated";
  sessionId: string;
  messageIds: string[];
  contextStatus: ContextStatus;
}

export interface UISummaryCreated {
  type: "summary:created";
  sessionId: string;
  summary: Summary;
}

export interface UISummaryDeleted {
  type: "summary:deleted";
  sessionId: string;
  summaryId: string;
  restoredMessageIds: string[];
}

export interface UIContextStatus {
  type: "context:status";
  sessionId: string;
  usedTokens: number;
  maxTokens: number;
}

export type ServerToUI =
  | SessionUpdated
  | MessageCreated
  | ThinkingStream
  | TokenStream
  | MessageComplete
  | UIToolCall
  | UIToolResult
  | UIToolApprovalRequest
  | UIContextUpdated
  | UISummaryCreated
  | UISummaryDeleted
  | UIContextStatus;
