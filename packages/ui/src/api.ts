import type { Session, Message } from "@simple-coder/shared";

export interface FileEntry {
  name: string;
  type: "file" | "directory";
  size: number;
  modifiedAt: string;
}

export async function listFiles(path = ""): Promise<FileEntry[]> {
  const params = path ? `?path=${encodeURIComponent(path)}` : "";
  const res = await fetch(`/api/files${params}`);
  if (!res.ok) throw new Error(`Failed to list files: ${res.status}`);
  return res.json();
}

export async function readFileContent(path: string): Promise<string> {
  const res = await fetch(`/api/files/read?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`Failed to read file: ${res.status}`);
  return res.text();
}

export async function createSession(
  title: string,
  message: string,
  includeClaudeMd = false,
): Promise<{ session: Session; message: Message }> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, message, includeClaudeMd }),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
  return res.json();
}

export async function listSessions(): Promise<Session[]> {
  const res = await fetch("/api/sessions");
  if (!res.ok) throw new Error(`Failed to list sessions: ${res.status}`);
  return res.json();
}

export async function getSession(
  id: string
): Promise<{ session: Session; messages: Message[] }> {
  const res = await fetch(`/api/sessions/${id}`);
  if (!res.ok) throw new Error(`Failed to get session: ${res.status}`);
  return res.json();
}

export async function renameSession(
  sessionId: string,
  title: string
): Promise<{ session: Session }> {
  const res = await fetch(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Failed to rename session: ${res.status}`);
  return res.json();
}

export async function sendMessage(
  sessionId: string,
  content: string
): Promise<{ message: Message }> {
  const res = await fetch(`/api/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: content }),
  });
  if (!res.ok) throw new Error(`Failed to send message: ${res.status}`);
  return res.json();
}

export async function stopSession(sessionId: string): Promise<void> {
  const res = await fetch(`/api/sessions/${sessionId}/stop`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to stop session: ${res.status}`);
}

export async function restartSession(sessionId: string): Promise<void> {
  const res = await fetch(`/api/sessions/${sessionId}/restart`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to restart session: ${res.status}`);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`/api/sessions/${sessionId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete session: ${res.status}`);
}

export async function approveToolCall(toolCallId: string): Promise<void> {
  const res = await fetch(`/api/tools/${toolCallId}/approve`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to approve tool call: ${res.status}`);
}

export async function rejectToolCall(toolCallId: string): Promise<void> {
  const res = await fetch(`/api/tools/${toolCallId}/reject`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to reject tool call: ${res.status}`);
}

export async function respondToToolCall(
  toolCallId: string,
  response: string
): Promise<void> {
  const res = await fetch(`/api/tools/${toolCallId}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response }),
  });
  if (!res.ok) throw new Error(`Failed to respond to tool call: ${res.status}`);
}

export async function setContextStatus(
  messageId: string,
  status: string
): Promise<void> {
  const res = await fetch(`/api/messages/${messageId}/context-status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to set context status: ${res.status}`);
}

export async function createSummary(
  sessionId: string,
  content: string,
  messageIds: string[]
): Promise<void> {
  const res = await fetch(`/api/sessions/${sessionId}/summaries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, messageIds, createdBy: "user" }),
  });
  if (!res.ok) throw new Error(`Failed to create summary: ${res.status}`);
}

export async function deleteSummary(summaryId: string): Promise<void> {
  const res = await fetch(`/api/summaries/${summaryId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete summary: ${res.status}`);
}

export async function getTokenBudget(): Promise<number> {
  const res = await fetch("/api/settings/token-budget");
  if (!res.ok) throw new Error(`Failed to get token budget: ${res.status}`);
  const data = await res.json();
  return data.tokenBudget;
}

export async function setTokenBudget(tokenBudget: number): Promise<number> {
  const res = await fetch("/api/settings/token-budget", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokenBudget }),
  });
  if (!res.ok) throw new Error(`Failed to set token budget: ${res.status}`);
  const data = await res.json();
  return data.tokenBudget;
}

export async function getContextStatus(
  sessionId: string
): Promise<{ usedTokens: number; maxTokens: number }> {
  const res = await fetch(`/api/sessions/${sessionId}/context`);
  if (!res.ok) throw new Error(`Failed to get context status: ${res.status}`);
  return res.json();
}
