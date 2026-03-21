import { useState, useRef, useEffect } from "react";
import type { Session } from "@simple-coder/shared";
import * as api from "../api";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  const startEditing = (session: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditValue(session.title || "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await api.renameSession(editingId, editValue.trim());
    } catch (err) {
      console.error("Failed to rename session:", err);
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  const handleStop = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.stopSession(sessionId);
    } catch (err) {
      console.error("Failed to stop session:", err);
    }
  };

  const handleRestart = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.restartSession(sessionId);
    } catch (err) {
      console.error("Failed to restart session:", err);
    }
  };

  const handleDeleteClick = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(sessionId);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return;
    try {
      await api.deleteSession(confirmDeleteId);
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
    setConfirmDeleteId(null);
  };

  const handleDeleteCancel = () => {
    setConfirmDeleteId(null);
  };

  const isStoppable = (state: string) => state === "active" || state === "pending";
  const isRestartable = (state: string) => state === "stopped" || state === "completed";

  const iconButton = {
    background: "#fff",
    border: "1px solid #d1d5db",
    borderRadius: 4,
    cursor: "pointer",
    padding: "2px 5px",
    flexShrink: 0 as const,
    lineHeight: 1,
  };

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
        {sessions.map((session) => {
          const isEditing = editingId === session.id;
          return (
            <div
              key={session.id}
              onClick={() => !isEditing && onSelect(session.id)}
              style={{
                padding: "10px 16px",
                cursor: isEditing ? "default" : "pointer",
                backgroundColor: session.id === selectedId ? "#eff6ff" : "transparent",
                borderBottom: "1px solid #f3f4f6",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isEditing ? (
                  <>
                    <input
                      ref={inputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={saveEdit}
                      placeholder="Untitled"
                      style={{
                        flex: 1,
                        fontSize: 14,
                        padding: "2px 4px",
                        border: "1px solid #d1d5db",
                        borderRadius: 4,
                        outline: "none",
                        minWidth: 0,
                      }}
                    />
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => { e.stopPropagation(); saveEdit(); }}
                      title="Save"
                      style={{ ...iconButton, fontSize: 14, color: "#22c55e" }}
                    >
                      ✓
                    </button>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        flex: 1,
                        fontSize: 14,
                        fontWeight: session.id === selectedId ? 600 : 400,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {session.title || "Untitled"}
                    </div>
                    <button
                      onClick={(e) => startEditing(session, e)}
                      title="Rename session"
                      style={{ ...iconButton, fontSize: 13, color: "#9ca3af" }}
                    >
                      ✎
                    </button>
                    {isStoppable(session.state) && (
                      <button
                        onClick={(e) => handleStop(session.id, e)}
                        title="Stop session"
                        style={{ ...iconButton, fontSize: 12, color: "#ef4444" }}
                      >
                        ■
                      </button>
                    )}
                    {isRestartable(session.state) && (
                      <button
                        onClick={(e) => handleRestart(session.id, e)}
                        title="Restart session"
                        style={{ ...iconButton, fontSize: 12, color: "#22c55e" }}
                      >
                        ▶
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDeleteClick(session.id, e)}
                      title="Delete session"
                      style={{ ...iconButton, fontSize: 13, color: "#9ca3af" }}
                    >
                      🗑
                    </button>
                  </>
                )}
              </div>
              <div style={{ fontSize: 12, color: stateColors[session.state] || "#6b7280", marginTop: 2 }}>
                {session.state}
              </div>
            </div>
          );
        })}
        {sessions.length === 0 && (
          <div style={{ padding: 16, color: "#9ca3af", fontSize: 14, textAlign: "center" }}>
            No sessions yet
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {confirmDeleteId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={handleDeleteCancel}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              borderRadius: 8,
              padding: "20px 24px",
              maxWidth: 320,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              Delete session?
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
              This will permanently delete the session and all its messages.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={handleDeleteCancel}
                style={{
                  padding: "6px 14px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                style={{
                  padding: "6px 14px",
                  border: "none",
                  borderRadius: 6,
                  backgroundColor: "#ef4444",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
