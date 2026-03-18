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
} as const;

export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];
