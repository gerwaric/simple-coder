import { useState, useRef, useEffect } from "react";
import type { Message, Session, Summary } from "@simple-coder/shared";
import { MessageBubble } from "./MessageBubble";
import { ToolPairBubble } from "./ToolPairBubble";
import { StreamingMessage } from "./StreamingMessage";
import * as api from "../api";

interface ContextGauge {
  usedTokens: number;
  maxTokens: number;
}

type DisplayItem =
  | { kind: "message"; message: Message }
  | { kind: "summary"; summary: Summary }
  | { kind: "toolPair"; call: Message; result: Message }
  | { kind: "toolPending"; call: Message };

function buildDisplayList(messages: Message[], summaries: Summary[]): DisplayItem[] {
  const summarizedIds = new Set(summaries.flatMap((s) => s.messageIds));
  const items: DisplayItem[] = [];

  // Index tool results by toolCallId for pairing
  const resultsByCallId = new Map<string, Message>();
  for (const msg of messages) {
    if (msg.role === "tool_result" && msg.toolCallId) {
      resultsByCallId.set(msg.toolCallId, msg);
    }
  }

  // Track tool results that have been paired
  const pairedResultIds = new Set<string>();

  // Add non-summarized messages, grouping tool pairs
  for (const msg of messages) {
    if (msg.contextStatus === "summarized" || summarizedIds.has(msg.id)) continue;

    if (msg.role === "tool_call" && msg.toolCallId) {
      const result = resultsByCallId.get(msg.toolCallId);
      if (result && !summarizedIds.has(result.id) && result.contextStatus !== "summarized") {
        items.push({ kind: "toolPair", call: msg, result });
        pairedResultIds.add(result.id);
      } else {
        items.push({ kind: "toolPending", call: msg });
      }
    } else if (msg.role === "tool_result" && pairedResultIds.has(msg.id)) {
      // Skip — already included in a toolPair
      continue;
    } else {
      items.push({ kind: "message", message: msg });
    }
  }

  // Add summaries
  for (const summary of summaries) {
    items.push({ kind: "summary", summary });
  }

  // Sort by timestamp
  items.sort((a, b) => {
    const aTime = a.kind === "message"
      ? a.message.createdAt
      : a.kind === "summary"
        ? a.summary.positionAt
        : a.kind === "toolPair"
          ? a.call.createdAt
          : a.call.createdAt;
    const bTime = b.kind === "message"
      ? b.message.createdAt
      : b.kind === "summary"
        ? b.summary.positionAt
        : b.kind === "toolPair"
          ? b.call.createdAt
          : b.call.createdAt;
    return aTime.localeCompare(bTime);
  });

  return items;
}

export function ChatPanel({
  session,
  messages,
  streamingThinking,
  streamingContent,
  summaries,
  contextGauge,
  onSend,
  onStop,
  onCreateSession,
}: {
  session: Session | null;
  messages: Message[];
  streamingThinking: string;
  streamingContent: string;
  summaries: Summary[];
  contextGauge: ContextGauge | null;
  onSend: (content: string) => void;
  onStop: () => void;
  onCreateSession: (message: string) => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);

  useEffect(() => {
    const newCount = messages.length;
    const hasNewMessages = newCount > prevMessageCount.current;
    prevMessageCount.current = newCount;
    if (hasNewMessages || streamingThinking || streamingContent) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingThinking, streamingContent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");

    if (!session) {
      onCreateSession(text);
    } else {
      onSend(text);
    }
  };

  const isActive = session?.state === "active";
  const isPending = session?.state === "pending";
  const canSend = !session || isActive || isPending;

  const displayItems = buildDisplayList(messages, summaries);

  // Context gauge calculations
  const gaugePercent = contextGauge
    ? Math.round((contextGauge.usedTokens / contextGauge.maxTokens) * 100)
    : null;
  const gaugeWarning = gaugePercent != null && gaugePercent > 70;

  const handleDeleteSummary = async (summaryId: string) => {
    try {
      await api.deleteSummary(summaryId);
    } catch (err) {
      console.error("Failed to delete summary:", err);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {!session && messages.length === 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#9ca3af",
              fontSize: 16,
            }}
          >
            Type a message to start a new session
          </div>
        )}
        {displayItems.map((item) => {
          if (item.kind === "message") {
            return <MessageBubble key={item.message.id} message={item.message} />;
          }
          if (item.kind === "toolPair") {
            return (
              <ToolPairBubble
                key={item.call.id}
                call={item.call}
                result={item.result}
              />
            );
          }
          if (item.kind === "toolPending") {
            return (
              <ToolPairBubble
                key={item.call.id}
                call={item.call}
              />
            );
          }
          // Summary card
          const s = item.summary;
          return (
            <div
              key={s.id}
              style={{
                margin: "8px 0",
                padding: "8px 12px",
                backgroundColor: "#f0f9ff",
                border: "1px solid #bae6fd",
                borderRadius: 8,
                fontSize: 13,
                color: "#0c4a6e",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "#6b7280" }}>
                  Summary of {s.messageIds.length} messages
                </span>
                <button
                  onClick={() => handleDeleteSummary(s.id)}
                  title="Restore original messages"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11,
                    color: "#2563eb",
                    padding: 0,
                  }}
                >
                  Restore
                </button>
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{s.content}</div>
            </div>
          );
        })}
        <StreamingMessage thinking={streamingThinking} content={streamingContent} />
        <div ref={bottomRef} />
      </div>
      {/* Context gauge */}
      {contextGauge && gaugePercent != null && (
        <div
          style={{
            padding: "4px 16px",
            fontSize: 12,
            color: gaugeWarning ? "#b45309" : "#6b7280",
            fontWeight: gaugeWarning ? 600 : 400,
            backgroundColor: gaugeWarning ? "#fef3c7" : "#fafafa",
            borderTop: "1px solid #e5e7eb",
          }}
        >
          {messages.filter((m) => m.contextStatus === "active").length} messages · {contextGauge.usedTokens.toLocaleString()} / {contextGauge.maxTokens.toLocaleString()} tokens ({gaugePercent}%)
        </div>
      )}
      <div style={{ borderTop: "1px solid #e5e7eb", padding: 12 }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={canSend ? "Type a message..." : "Session is not active"}
            disabled={!canSend}
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={!canSend || !input.trim()}
            style={{
              padding: "8px 16px",
              backgroundColor: canSend && input.trim() ? "#2563eb" : "#9ca3af",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: canSend && input.trim() ? "pointer" : "default",
              fontSize: 14,
            }}
          >
            Send
          </button>
          {isActive && (
            <button
              type="button"
              onClick={onStop}
              style={{
                padding: "8px 16px",
                backgroundColor: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Stop
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
