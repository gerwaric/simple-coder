import { useState, useRef, useEffect } from "react";
import type { Message, Session } from "@simple-coder/shared";
import { MessageBubble } from "./MessageBubble";
import { StreamingMessage } from "./StreamingMessage";

export function ChatPanel({
  session,
  messages,
  streamingThinking,
  streamingContent,
  onSend,
  onStop,
  onCreateSession,
}: {
  session: Session | null;
  messages: Message[];
  streamingThinking: string;
  streamingContent: string;
  onSend: (content: string) => void;
  onStop: () => void;
  onCreateSession: (message: string) => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
  const canSend = !session || isActive;

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
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <StreamingMessage thinking={streamingThinking} content={streamingContent} />
        <div ref={bottomRef} />
      </div>
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
