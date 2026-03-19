import type { Session } from "@simple-coder/shared";

const stateColors: Record<string, string> = {
  pending: "#f59e0b",
  active: "#10b981",
  completed: "#6b7280",
  stopped: "#ef4444",
};

export function SessionList({
  sessions,
  selectedId,
  onSelect,
  onNew,
}: {
  sessions: Session[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb" }}>
        <button
          onClick={onNew}
          style={{
            width: "100%",
            padding: "8px 12px",
            backgroundColor: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          New Session
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => onSelect(session.id)}
            style={{
              padding: "10px 16px",
              cursor: "pointer",
              backgroundColor: session.id === selectedId ? "#eff6ff" : "transparent",
              borderBottom: "1px solid #f3f4f6",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: session.id === selectedId ? 600 : 400,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {session.title || "Untitled"}
            </div>
            <div style={{ fontSize: 12, color: stateColors[session.state] || "#6b7280", marginTop: 2 }}>
              {session.state}
            </div>
          </div>
        ))}
        {sessions.length === 0 && (
          <div style={{ padding: 16, color: "#9ca3af", fontSize: 14, textAlign: "center" }}>
            No sessions yet
          </div>
        )}
      </div>
    </div>
  );
}
