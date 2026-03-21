import type { Message } from "@simple-coder/shared";
import { ToolCallMessage } from "./ToolCallMessage";
import { ToolResultMessage } from "./ToolResultMessage";
import * as api from "../api";

export function ToolPairBubble({
  call,
  result,
  onContextChange,
}: {
  call: Message;
  result?: Message;
  onContextChange?: () => void;
}) {
  const isPending = !result;
  const isInactive = call.contextStatus === "inactive";
  const barColor = isPending ? "#d1d5db" : isInactive ? "#f97316" : "#22c55e";

  const handleToggle = async () => {
    if (isPending) return;
    const newStatus = isInactive ? "active" : "inactive";
    try {
      await api.setContextStatus(call.id, newStatus);
      if (result) await api.setContextStatus(result.id, newStatus);
      onContextChange?.();
    } catch (err) {
      console.error("Failed to update tool pair context:", err);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-start",
        marginBottom: 8,
        opacity: isInactive ? 0.5 : 1,
      }}
    >
      <div style={{ display: "flex", gap: 6, maxWidth: "75%" }}>
        {/* Context bar */}
        <button
          onClick={handleToggle}
          disabled={isPending}
          title={
            isPending
              ? "Waiting for result"
              : isInactive
                ? "Restore to context"
                : "Drop from context"
          }
          style={{
            width: 6,
            minWidth: 6,
            alignSelf: "stretch",
            backgroundColor: barColor,
            border: "none",
            borderRadius: 3,
            cursor: isPending ? "default" : "pointer",
            padding: 0,
            flexShrink: 0,
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {/* Tool call */}
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              backgroundColor: isInactive ? "#e5e7eb" : "#f9fafb",
              color: isInactive ? "#9ca3af" : "#1f2937",
              border: "1px solid #e5e7eb",
              wordBreak: "break-word",
            }}
          >
            <ToolCallMessage message={call} />
          </div>

          {/* Tool result */}
          {result && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                backgroundColor: isInactive ? "#e5e7eb" : "#f9fafb",
                color: isInactive ? "#9ca3af" : "#1f2937",
                border: "1px solid #e5e7eb",
                wordBreak: "break-word",
              }}
            >
              <ToolResultMessage message={result} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
