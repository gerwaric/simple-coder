import { useState, useEffect, useCallback } from "react";
import type { Session, Message, Summary, ServerToUI } from "@simple-coder/shared";
import * as api from "../api";
import { useWebSocket } from "./useWebSocket";

interface ContextGauge {
  usedTokens: number;
  maxTokens: number;
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Map<string, Message[]>>(new Map());
  const [streamingThinking, setStreamingThinking] = useState<Map<string, string>>(new Map());
  const [streamingContent, setStreamingContent] = useState<Map<string, string>>(new Map());
  const [summaries, setSummaries] = useState<Map<string, Summary[]>>(new Map());
  const [contextGauge, setContextGauge] = useState<Map<string, ContextGauge>>(new Map());
  const [agentWarnings, setAgentWarnings] = useState<Map<string, { message: string; retryAt?: string; receivedAt: string }[]>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    setError(msg);
  }, []);

  // Load sessions on mount
  useEffect(() => {
    api.listSessions().then(setSessions).catch(handleError);
  }, [handleError]);

  // Load messages when session selected
  useEffect(() => {
    if (!selectedSessionId) return;
    if (messages.has(selectedSessionId)) return;
    api
      .getSession(selectedSessionId)
      .then(({ messages: msgs }) => {
        setMessages((prev) => new Map(prev).set(selectedSessionId, msgs));
      })
      .catch(handleError);
  }, [selectedSessionId, messages, handleError]);

  // Load context status when session selected
  useEffect(() => {
    if (!selectedSessionId) return;
    if (contextGauge.has(selectedSessionId)) return;
    api
      .getContextStatus(selectedSessionId)
      .then((gauge) => {
        setContextGauge((prev) => new Map(prev).set(selectedSessionId, gauge));
      })
      .catch(handleError);
  }, [selectedSessionId, contextGauge, handleError]);

  const upsertMessage = (msg: Message) => {
    setMessages((prev) => {
      const sessionMsgs = prev.get(msg.sessionId) || [];
      // Match by id, or by toolCallId+role for tool messages (synthetic messages use toolCallId as id)
      const idx = sessionMsgs.findIndex(
        (m) =>
          m.id === msg.id ||
          (msg.toolCallId && m.toolCallId === msg.toolCallId && m.role === msg.role)
      );
      if (idx >= 0) {
        const next = [...sessionMsgs];
        next[idx] = msg;
        return new Map(prev).set(msg.sessionId, next);
      }
      return new Map(prev).set(msg.sessionId, [...sessionMsgs, msg]);
    });
  };

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
        upsertMessage(msg.message);
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
        upsertMessage(msg.message);
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

      case "tool:call":
        // Create a tool_call message in state, using real DB ID if available
        upsertMessage({
          id: msg.messageId || msg.toolCallId,
          sessionId: msg.sessionId,
          role: "tool_call",
          content: "",
          thinking: null,
          toolName: msg.toolName,
          toolArgs: msg.args,
          toolCallId: msg.toolCallId,
          approvalStatus: null,
          contextStatus: "active",
          tokenCount: null,
          createdAt: new Date().toISOString(),
        });
        break;

      case "tool:result":
        upsertMessage({
          id: msg.messageId || `${msg.toolCallId}-result`,
          sessionId: msg.sessionId,
          role: "tool_result",
          content: typeof msg.result === "string" ? msg.result : JSON.stringify(msg.result, null, 2),
          thinking: null,
          toolName: msg.toolName,
          toolArgs: null,
          toolCallId: msg.toolCallId,
          approvalStatus: null,
          contextStatus: "active",
          tokenCount: null,
          createdAt: new Date().toISOString(),
        });
        break;

      case "tool:approval:request":
        // Upsert the tool call message with pending approval
        upsertMessage({
          id: msg.messageId || msg.toolCallId,
          sessionId: msg.sessionId,
          role: "tool_call",
          content: "",
          thinking: null,
          toolName: msg.toolName,
          toolArgs: msg.args,
          toolCallId: msg.toolCallId,
          approvalStatus: "pending",
          contextStatus: "active",
          tokenCount: null,
          createdAt: new Date().toISOString(),
        });
        break;

      case "context:updated":
        setMessages((prev) => {
          const sessionMsgs = prev.get(msg.sessionId);
          if (!sessionMsgs) return prev;
          const updated = sessionMsgs.map((m) =>
            msg.messageIds.includes(m.id)
              ? { ...m, contextStatus: msg.contextStatus }
              : m
          );
          return new Map(prev).set(msg.sessionId, updated);
        });
        break;

      case "summary:created":
        setSummaries((prev) => {
          const existing = prev.get(msg.sessionId) || [];
          return new Map(prev).set(msg.sessionId, [...existing, msg.summary]);
        });
        // Mark summarized messages
        setMessages((prev) => {
          const sessionMsgs = prev.get(msg.sessionId);
          if (!sessionMsgs) return prev;
          const updated = sessionMsgs.map((m) =>
            msg.summary.messageIds.includes(m.id)
              ? { ...m, contextStatus: "summarized" as const }
              : m
          );
          return new Map(prev).set(msg.sessionId, updated);
        });
        break;

      case "summary:deleted":
        setSummaries((prev) => {
          const existing = prev.get(msg.sessionId) || [];
          return new Map(prev).set(
            msg.sessionId,
            existing.filter((s) => s.id !== msg.summaryId)
          );
        });
        // Restore messages to active
        setMessages((prev) => {
          const sessionMsgs = prev.get(msg.sessionId);
          if (!sessionMsgs) return prev;
          const updated = sessionMsgs.map((m) =>
            msg.restoredMessageIds.includes(m.id)
              ? { ...m, contextStatus: "active" as const }
              : m
          );
          return new Map(prev).set(msg.sessionId, updated);
        });
        break;

      case "context:status":
        setContextGauge((prev) =>
          new Map(prev).set(msg.sessionId, {
            usedTokens: msg.usedTokens,
            maxTokens: msg.maxTokens,
          })
        );
        break;

      case "agent:warning":
        setAgentWarnings((prev) => {
          const existing = prev.get(msg.sessionId) || [];
          return new Map(prev).set(msg.sessionId, [
            ...existing,
            { message: msg.message, retryAt: msg.retryAt, receivedAt: new Date().toISOString() },
          ]);
        });
        break;

      case "session:deleted":
        setSessions((prev) => prev.filter((s) => s.id !== msg.sessionId));
        setSelectedSessionId((prev) => prev === msg.sessionId ? null : prev);
        break;
    }
  }, []);

  const { connected } = useWebSocket(handleWsMessage);

  const createSession = useCallback(async (message: string, includeClaudeMd = false) => {
    try {
      const { session } = await api.createSession("", message, includeClaudeMd);
      setSelectedSessionId(session.id);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!selectedSessionId) return;
      try {
        await api.sendMessage(selectedSessionId, content);
      } catch (err) {
        handleError(err);
      }
    },
    [selectedSessionId, handleError]
  );

  const stopSession = useCallback(async () => {
    if (!selectedSessionId) return;
    try {
      await api.stopSession(selectedSessionId);
    } catch (err) {
      handleError(err);
    }
  }, [selectedSessionId, handleError]);

  const clearError = useCallback(() => setError(null), []);

  const refreshContextGauge = useCallback((sessionId: string, gauge: { usedTokens: number; maxTokens: number }) => {
    setContextGauge((prev) => new Map(prev).set(sessionId, gauge));
  }, []);

  const currentGauge = selectedSessionId ? contextGauge.get(selectedSessionId) || null : null;
  const currentSummaries = selectedSessionId ? summaries.get(selectedSessionId) || [] : [];
  const currentWarnings = selectedSessionId ? agentWarnings.get(selectedSessionId) || [] : [];

  return {
    sessions,
    selectedSessionId,
    setSelectedSessionId,
    messages: selectedSessionId ? messages.get(selectedSessionId) || [] : [],
    streamingThinking: selectedSessionId ? streamingThinking.get(selectedSessionId) || "" : "",
    streamingContent: selectedSessionId ? streamingContent.get(selectedSessionId) || "" : "",
    summaries: currentSummaries,
    contextGauge: currentGauge,
    connected,
    error,
    clearError,
    createSession,
    sendMessage,
    stopSession,
    refreshContextGauge,
    agentWarnings: currentWarnings,
  };
}
