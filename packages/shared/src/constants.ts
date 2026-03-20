export const SessionState = {
  Pending: "pending",
  Active: "active",
  Completed: "completed",
  Stopped: "stopped",
} as const;

export type SessionState = (typeof SessionState)[keyof typeof SessionState];

export const MessageRole = {
  User: "user",
  Assistant: "assistant",
  System: "system",
  ToolCall: "tool_call",
  ToolResult: "tool_result",
} as const;

export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

export const ApprovalStatus = {
  Pending: "pending",
  Approved: "approved",
  Rejected: "rejected",
} as const;

export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const ContextStatus = {
  Active: "active",
  Summarized: "summarized",
  Inactive: "inactive",
} as const;

export type ContextStatus = (typeof ContextStatus)[keyof typeof ContextStatus];
