import { useState } from "react";
import * as api from "../api";

export function AskHumanPrompt({
  toolCallId,
  approvalStatus,
}: {
  toolCallId: string;
  approvalStatus: string | null;
}) {
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentResponse, setSentResponse] = useState<string | null>(null);

  const resolved = sentResponse !== null || approvalStatus !== "pending";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setSubmitting(true);
    setSentResponse(text);
    try {
      await api.respondToToolCall(toolCallId, text);
    } catch (err) {
      console.error("Failed to respond:", err);
      setSentResponse(null);
      setSubmitting(false);
    }
  };

  if (resolved) {
    return (
      <div style={{ marginTop: 6, fontSize: 12, color: "#059669" }}>
        Responded: {sentResponse || "(sent)"}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 6, display: "flex", gap: 6 }}>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type your response..."
        disabled={submitting}
        style={{
          flex: 1,
          padding: "4px 8px",
          fontSize: 13,
          border: "1px solid #d1d5db",
          borderRadius: 4,
          outline: "none",
        }}
      />
      <button
        type="submit"
        disabled={submitting || !input.trim()}
        style={{
          padding: "4px 12px",
          fontSize: 13,
          backgroundColor: input.trim() && !submitting ? "#2563eb" : "#9ca3af",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: input.trim() && !submitting ? "pointer" : "default",
        }}
      >
        Send
      </button>
    </form>
  );
}
