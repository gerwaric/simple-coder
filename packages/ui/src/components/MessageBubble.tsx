import type { Message } from "@simple-coder/shared";
import { useState } from "react";
import { ToolCallMessage } from "./ToolCallMessage";
import { ToolResultMessage } from "./ToolResultMessage";
import * as api from "../api";

export function MessageBubble({
  message,
  onContextChange,
}: {
  message: Message;
  onContextChange?: () => void;
}) {
  const [showThinking, setShowThinking] = useState(false);
  const isUser = message.role === "user";
  const isToolCall = message.role === "tool_call";
  const isToolResult = message.role === "tool_result";
  const isTool = isToolCall || isToolResult;
  const isInactive = message.contextStatus === "inactive";
  const showContextBar = !isTool;

  const handleDrop = async () => {
    try {
      await api.setContextStatus(message.id, "inactive");
      onContextChange?.();
    } catch (err) {
      console.error("Failed to drop message:", err);
    }
  };

  const handleRestore = async () => {
    try {
      await api.setContextStatus(message.id, "active");
      onContextChange?.();
    } catch (err) {
      console.error("Failed to restore message:", err);
    }
  };

  const align = isUser ? "flex-end" : "flex-start";
  const bgColor = isInactive
    ? "#e5e7eb"
    : isTool
      ? "#f9fafb"
      : isUser
        ? "#2563eb"
        : "#f3f4f6";
  const textColor = isInactive ? "#9ca3af" : isUser ? "#fff" : "#1f2937";
  const borderStyle = isTool ? "1px solid #e5e7eb" : "none";
  const barColor = isInactive ? "#f97316" : "#22c55e";

  const contextBar = showContextBar ? (
    <button
      onClick={isInactive ? handleRestore : handleDrop}
      title={isInactive ? "Restore to context" : "Drop from context"}
      style={{
        width: 6,
        minWidth: 6,
        alignSelf: "stretch",
        backgroundColor: barColor,
        border: "none",
        borderRadius: 3,
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
      }}
    />
  ) : null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: align,
        marginBottom: 8,
        opacity: isInactive ? 0.5 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 6,
          maxWidth: "75%",
          flexDirection: isUser ? "row" : "row",
        }}
      >
        {/* Context bar on left for agent messages */}
        {!isUser && contextBar}

        <div
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            backgroundColor: bgColor,
            color: textColor,
            border: borderStyle,
            wordBreak: "break-word",
          }}
        >
          {/* Tool call rendering */}
          {isToolCall && <ToolCallMessage message={message} />}

          {/* Tool result rendering */}
          {isToolResult && <ToolResultMessage message={message} />}

          {/* Standard message rendering (user/assistant/system) */}
          {!isTool && (
            <>
              {message.thinking && (
                <div style={{ marginBottom: 4 }}>
                  <button
                    onClick={() => setShowThinking(!showThinking)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      color: isUser ? "#bfdbfe" : "#6b7280",
                      padding: 0,
                    }}
                  >
                    {showThinking ? "Hide" : "Show"} thinking
                  </button>
                  {showThinking && (
                    <div
                      style={{
                        marginTop: 4,
                        padding: "6px 8px",
                        borderRadius: 4,
                        backgroundColor: isUser ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.05)",
                        fontStyle: "italic",
                        fontSize: 13,
                        color: isUser ? "#dbeafe" : "#6b7280",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {message.thinking}
                    </div>
                  )}
                </div>
              )}
              <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
            </>
          )}

          {/* Token count */}
          {message.tokenCount != null && (
            <div
              style={{
                marginTop: 4,
                fontSize: 10,
                color: isUser ? "rgba(255,255,255,0.4)" : "#d1d5db",
                textAlign: "right",
              }}
            >
              {message.tokenCount} tokens
            </div>
          )}
        </div>

        {/* Context bar on right for user messages */}
        {isUser && contextBar}
      </div>
    </div>
  );
}
