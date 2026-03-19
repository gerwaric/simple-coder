import { useState, useEffect, useCallback } from "react";
import type { Session, Message, ServerToUI } from "@simple-coder/shared";
import * as api from "../api";
import { useWebSocket } from "./useWebSocket";

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Map<string, Message[]>>(new Map());
  const [streamingThinking, setStreamingThinking] = useState<Map<string, string>>(new Map());
  const [streamingContent, setStreamingContent] = useState<Map<string, string>>(new Map());

  // Load sessions on mount
  useEffect(() => {
    api.listSessions().then(setSessions).catch(console.error);
  }, []);

  // Load messages when session selected
  useEffect(() => {
    if (!selectedSessionId) return;
    if (messages.has(selectedSessionId)) return;
    api
      .getSession(selectedSessionId)
      .then(({ messages: msgs }) => {
        setMessages((prev) => new Map(prev).set(selectedSessionId, msgs));
      })
      .catch(console.error);
  }, [selectedSessionId, messages]);

  const handleWsMessage = useCallback((msg: ServerToUI) => {
    switch (msg.type) {
      case "session:updated":
        setSessions((prev) => {
          const idx = prev.findIndex((s) => s.id === msg.session.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = msg.session;
            return next;
          }
          return [msg.session, ...prev];
        });
        break;

      case "message:created":
        setMessages((prev) => {
          const sessionMsgs = prev.get(msg.message.sessionId) || [];
          // Avoid duplicates
          if (sessionMsgs.some((m) => m.id === msg.message.id)) return prev;
          return new Map(prev).set(msg.message.sessionId, [...sessionMsgs, msg.message]);
        });
        break;

      case "thinking:stream":
        setStreamingThinking((prev) => {
          const current = prev.get(msg.sessionId) || "";
          return new Map(prev).set(msg.sessionId, current + msg.token);
        });
        break;

      case "token:stream":
        setStreamingContent((prev) => {
          const current = prev.get(msg.sessionId) || "";
          return new Map(prev).set(msg.sessionId, current + msg.token);
        });
        break;

      case "message:complete":
        // Append final message and clear streaming state
        setMessages((prev) => {
          const sessionMsgs = prev.get(msg.message.sessionId) || [];
          if (sessionMsgs.some((m) => m.id === msg.message.id)) return prev;
          return new Map(prev).set(msg.message.sessionId, [...sessionMsgs, msg.message]);
        });
        setStreamingThinking((prev) => {
          const next = new Map(prev);
          next.delete(msg.message.sessionId);
          return next;
        });
        setStreamingContent((prev) => {
          const next = new Map(prev);
          next.delete(msg.message.sessionId);
          return next;
        });
        break;
    }
  }, []);

  const { connected } = useWebSocket(handleWsMessage);

  const createSession = useCallback(async (message: string) => {
    const { session } = await api.createSession("", message);
    setSelectedSessionId(session.id);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!selectedSessionId) return;
      await api.sendMessage(selectedSessionId, content);
    },
    [selectedSessionId]
  );

  const stopSession = useCallback(async () => {
    if (!selectedSessionId) return;
    await api.stopSession(selectedSessionId);
  }, [selectedSessionId]);

  return {
    sessions,
    selectedSessionId,
    setSelectedSessionId,
    messages: selectedSessionId ? messages.get(selectedSessionId) || [] : [],
    streamingThinking: selectedSessionId ? streamingThinking.get(selectedSessionId) || "" : "",
    streamingContent: selectedSessionId ? streamingContent.get(selectedSessionId) || "" : "",
    connected,
    createSession,
    sendMessage,
    stopSession,
  };
}
