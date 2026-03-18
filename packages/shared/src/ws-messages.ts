import type { Session, Message } from "./types.js";

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
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  type: "tool:result";
  sessionId: string;
  toolName: string;
  result: unknown;
}

export interface SessionStop {
  type: "session:stop";
  sessionId: string;
}

export interface SessionCompleted {
  type: "session:completed";
  sessionId: string;
}

export type AgentToServer =
  | AgentRegister
  | AgentReady
  | ThinkingToken
  | ThinkingComplete
  | AssistantToken
  | AssistantMessageComplete
  | ToolCall
  | SessionCompleted;

export type ServerToAgent =
  | SessionAssign
  | UserMessage
  | ToolResult
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
  toolName: string;
  args: Record<string, unknown>;
}

export interface UIToolResult {
  type: "tool:result";
  sessionId: string;
  toolName: string;
  result: unknown;
}

export type ServerToUI =
  | SessionUpdated
  | MessageCreated
  | ThinkingStream
  | TokenStream
  | MessageComplete
  | UIToolCall
  | UIToolResult;
