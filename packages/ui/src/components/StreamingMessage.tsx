import { useState } from "react";

export function StreamingMessage({
  thinking,
  content,
}: {
  thinking: string;
  content: string;
}) {
  const [showThinking, setShowThinking] = useState(true);

  if (!thinking && !content) return null;

  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 8 }}>
      <div
        style={{
          maxWidth: "75%",
          padding: "8px 12px",
          borderRadius: 8,
          backgroundColor: "#f3f4f6",
          color: "#1f2937",
          wordBreak: "break-word",
        }}
      >
        {thinking && (
          <div style={{ marginBottom: 4 }}>
            <button
              onClick={() => setShowThinking(!showThinking)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                color: "#6b7280",
                padding: 0,
              }}
            >
              {showThinking ? "Hide" : "Show"} thinking...
            </button>
            {showThinking && (
              <div
                style={{
                  marginTop: 4,
                  padding: "6px 8px",
                  borderRadius: 4,
                  backgroundColor: "rgba(0,0,0,0.05)",
                  fontStyle: "italic",
                  fontSize: 13,
                  color: "#6b7280",
                  whiteSpace: "pre-wrap",
                }}
              >
                {thinking}
                <span style={{ animation: "blink 1s infinite" }}>|</span>
              </div>
            )}
          </div>
        )}
        {content && (
          <div style={{ whiteSpace: "pre-wrap" }}>
            {content}
            <span style={{ animation: "blink 1s infinite" }}>|</span>
          </div>
        )}
        {!content && thinking && (
          <div style={{ fontSize: 13, color: "#9ca3af" }}>Thinking...</div>
        )}
      </div>
    </div>
  );
}
