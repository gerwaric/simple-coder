import type { Message } from "@simple-coder/shared";
import { useState } from "react";

export function MessageBubble({ message }: { message: Message }) {
  const [showThinking, setShowThinking] = useState(false);
  const isUser = message.role === "user";

  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 8 }}>
      <div
        style={{
          maxWidth: "75%",
          padding: "8px 12px",
          borderRadius: 8,
          backgroundColor: isUser ? "#2563eb" : "#f3f4f6",
          color: isUser ? "#fff" : "#1f2937",
          wordBreak: "break-word",
        }}
      >
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
      </div>
    </div>
  );
}
