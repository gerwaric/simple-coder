import { useState, useRef, useEffect, useCallback } from "react";
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

  // Index tool call IDs — used to skip standalone rendering of results that will be paired
  const toolCallIds = new Set<string>();
  for (const msg of messages) {
    if (msg.role === "tool_call" && msg.toolCallId) {
      toolCallIds.add(msg.toolCallId);
    }
  }

  // Add non-summarized messages, grouping tool pairs
  for (const msg of messages) {
    if (msg.contextStatus === "summarized" || summarizedIds.has(msg.id)) continue;

    if (msg.role === "tool_call" && msg.toolCallId) {
      const result = resultsByCallId.get(msg.toolCallId);
      if (result && !summarizedIds.has(result.id) && result.contextStatus !== "summarized") {
        items.push({ kind: "toolPair", call: msg, result });
      } else {
        items.push({ kind: "toolPending", call: msg });
      }
    } else if (msg.role === "tool_result" && msg.toolCallId && toolCallIds.has(msg.toolCallId)) {
      // Skip — will be included in a toolPair via its matching tool_call
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
  onTokenBudgetChange,
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
  onTokenBudgetChange?: (budget: number) => void;
}) {
  const [input, setInput] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [summaryInput, setSummaryInput] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
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

  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const budgetInputRef = useRef<HTMLInputElement>(null);

  const startEditingBudget = () => {
    if (!contextGauge) return;
    setBudgetInput(String(contextGauge.maxTokens));
    setEditingBudget(true);
    setTimeout(() => budgetInputRef.current?.select(), 0);
  };

  const commitBudget = useCallback(() => {
    setEditingBudget((wasEditing) => {
      if (!wasEditing) return false;
      // Read the input value from the ref directly to avoid stale closures
      const raw = budgetInputRef.current?.value;
      if (raw) {
        const val = parseInt(raw, 10);
        if (!isNaN(val) && val >= 1000 && onTokenBudgetChange) {
          onTokenBudgetChange(val);
        }
      }
      return false;
    });
  }, [onTokenBudgetChange]);

  const cancelBudget = useCallback(() => {
    setEditingBudget(false);
  }, []);

  const handleDeleteSummary = async (summaryId: string) => {
    try {
      await api.deleteSummary(summaryId);
    } catch (err) {
      console.error("Failed to delete summary:", err);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cancelSelection = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setSummaryInput(null);
  };

  const handleSummarize = async () => {
    if (!session || !summaryInput?.trim() || selectedIds.size === 0) return;
    setSummarizing(true);
    try {
      await api.createSummary(session.id, summaryInput.trim(), Array.from(selectedIds));
      cancelSelection();
    } catch (err) {
      console.error("Failed to create summary:", err);
    } finally {
      setSummarizing(false);
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
            const isSelectable = selectMode && item.message.contextStatus === "active";
            return (
              <MessageBubble
                key={item.message.id}
                message={item.message}
                selectable={isSelectable}
                selected={selectedIds.has(item.message.id)}
                onToggleSelect={() => toggleSelect(item.message.id)}
              />
            );
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
      {/* Selection action bar */}
      {selectMode && (
        <div
          style={{
            padding: "6px 16px",
            fontSize: 12,
            backgroundColor: "#eff6ff",
            borderTop: "1px solid #bfdbfe",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {summaryInput == null ? (
            <>
              <span style={{ color: "#1e40af", flex: 1 }}>
                {selectedIds.size} message{selectedIds.size !== 1 ? "s" : ""} selected
              </span>
              <button
                onClick={() => setSummaryInput("")}
                disabled={selectedIds.size === 0}
                style={{
                  padding: "3px 10px",
                  fontSize: 12,
                  backgroundColor: selectedIds.size > 0 ? "#2563eb" : "#9ca3af",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: selectedIds.size > 0 ? "pointer" : "default",
                }}
              >
                Summarize
              </button>
              <button
                onClick={cancelSelection}
                style={{
                  padding: "3px 10px",
                  fontSize: 12,
                  backgroundColor: "transparent",
                  color: "#6b7280",
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <input
                autoFocus
                value={summaryInput}
                onChange={(e) => setSummaryInput(e.target.value)}
                placeholder="Write a summary of the selected messages..."
                style={{
                  flex: 1,
                  padding: "4px 8px",
                  border: "1px solid #bfdbfe",
                  borderRadius: 4,
                  fontSize: 12,
                  outline: "none",
                }}
              />
              <button
                onClick={handleSummarize}
                disabled={!summaryInput?.trim() || summarizing}
                style={{
                  padding: "3px 10px",
                  fontSize: 12,
                  backgroundColor: summaryInput?.trim() ? "#2563eb" : "#9ca3af",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: summaryInput?.trim() ? "pointer" : "default",
                }}
              >
                {summarizing ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setSummaryInput(null)}
                style={{
                  padding: "3px 10px",
                  fontSize: 12,
                  backgroundColor: "transparent",
                  color: "#6b7280",
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Back
              </button>
            </>
          )}
        </div>
      )}
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
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
            {messages.filter((m) => m.contextStatus === "active").length} messages · ~{contextGauge.usedTokens.toLocaleString()} /{" "}
            {editingBudget ? (
              <input
                ref={budgetInputRef}
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                onBlur={commitBudget}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitBudget(); } if (e.key === "Escape") { e.preventDefault(); cancelBudget(); } }}
                style={{
                  width: 70,
                  fontSize: 12,
                  padding: "0 4px",
                  border: "1px solid #d1d5db",
                  borderRadius: 3,
                  fontFamily: "inherit",
                }}
              />
            ) : (
              <button
                onClick={startEditingBudget}
                title="Click to edit token budget"
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: "1px dashed #9ca3af",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "inherit",
                  fontFamily: "inherit",
                  padding: 0,
                }}
              >
                {contextGauge.maxTokens.toLocaleString()}
              </button>
            )}{" "}
            token budget (~{gaugePercent}%)
          </span>
          {session && !selectMode && (
            <button
              onClick={() => setSelectMode(true)}
              title="Select messages to summarize"
              style={{
                padding: "2px 8px",
                fontSize: 11,
                backgroundColor: "transparent",
                color: "#2563eb",
                border: "1px solid #bfdbfe",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Manually select &amp; summarize message(s)
            </button>
          )}
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
