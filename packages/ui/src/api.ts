import type { Session, Message } from "@simple-coder/shared";

export async function createSession(
  title: string,
  message: string
): Promise<{ session: Session; message: Message }> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, message }),
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
