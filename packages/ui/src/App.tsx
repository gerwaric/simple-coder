import { useState, useCallback, useRef, useEffect } from "react";
import { useSessions } from "./hooks/useSessions";
import { SessionList } from "./components/SessionList";
import { ChatPanel } from "./components/ChatPanel";
import { FileTree } from "./components/FileTree";
import { FileViewer } from "./components/FileViewer";
import * as api from "./api";
import { ErrorBoundary } from "./components/ErrorBoundary";

const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH = 800;
const DEFAULT_PANEL_WIDTH = 380;

export function App() {
  const [includeClaudeMd, setIncludeClaudeMd] = useState(false);
  const [filePanelOpen, setFilePanelOpen] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [filePanelWidth, setFilePanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const dragging = useRef(false);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setFilePanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newWidth)));
    };
    const onMouseUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);
  const {
    sessions,
    selectedSessionId,
    setSelectedSessionId,
    messages,
    streamingThinking,
    streamingContent,
    summaries,
    contextGauge,
    connected,
    error,
    clearError,
    createSession,
    sendMessage,
    stopSession,
    refreshContextGauge,
    agentWarnings,
  } = useSessions();

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      {!connected && (
        <div
          style={{
            backgroundColor: "#fef2f2",
            color: "#991b1b",
            padding: "6px 16px",
            fontSize: 13,
            textAlign: "center",
            borderBottom: "1px solid #fecaca",
          }}
        >
          Disconnected from server — reconnecting...
        </div>
      )}
      {error && (
        <div
          style={{
            backgroundColor: "#fef2f2",
            color: "#991b1b",
            padding: "6px 16px",
            fontSize: 13,
            textAlign: "center",
            borderBottom: "1px solid #fecaca",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>{error}</span>
          <button
            onClick={clearError}
            style={{
              background: "none",
              border: "none",
              color: "#991b1b",
              cursor: "pointer",
              fontSize: 16,
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>
      )}
      <ErrorBoundary>
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <div
            style={{
              width: 260,
              borderRight: "1px solid #e5e7eb",
              backgroundColor: "#fafafa",
              flexShrink: 0,
            }}
          >
            <SessionList
              sessions={sessions}
              selectedId={selectedSessionId}
              includeClaudeMd={includeClaudeMd}
              onToggleClaudeMd={() => setIncludeClaudeMd((v) => !v)}
              onSelect={(id) => setSelectedSessionId(id)}
              onNew={() => setSelectedSessionId(null)}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
            <ChatPanel
              session={selectedSession}
              messages={messages}
              streamingThinking={streamingThinking}
              streamingContent={streamingContent}
              summaries={summaries}
              contextGauge={contextGauge}
              onSend={sendMessage}
              onStop={stopSession}
              onCreateSession={(msg) => createSession(msg, includeClaudeMd)}
              agentWarnings={agentWarnings}
              onTokenBudgetChange={async (budget) => {
                try {
                  await api.setTokenBudget(budget);
                  if (selectedSessionId) {
                    const gauge = await api.getContextStatus(selectedSessionId);
                    refreshContextGauge(selectedSessionId, gauge);
                  }
                } catch (err) {
                  console.error("Failed to set token budget:", err);
                }
              }}
            />
            <button
              onClick={() => setFilePanelOpen((v) => !v)}
              title={filePanelOpen ? "Hide file browser" : "Show file browser"}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 10,
                padding: "4px 10px",
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: filePanelOpen ? "#4f46e5" : "#f3f4f6",
                color: filePanelOpen ? "#fff" : "#6b7280",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "system-ui, sans-serif",
                fontWeight: 500,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Files
            </button>
          </div>
          {filePanelOpen && (
            <div
              style={{
                width: filePanelWidth,
                flexShrink: 0,
                display: "flex",
                backgroundColor: "#fff",
                position: "relative",
              }}
            >
              <div
                onMouseDown={onDragStart}
                style={{
                  width: 4,
                  cursor: "col-resize",
                  backgroundColor: "transparent",
                  flexShrink: 0,
                  borderLeft: "1px solid #e5e7eb",
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = "#c7d2fe"; }}
                onMouseLeave={(e) => { if (!dragging.current) (e.target as HTMLElement).style.backgroundColor = "transparent"; }}
              />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div
                style={{
                  height: "40%",
                  borderBottom: "1px solid #e5e7eb",
                  overflow: "hidden",
                }}
              >
                <FileTree
                  onSelectFile={setSelectedFilePath}
                  selectedPath={selectedFilePath}
                />
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                {selectedFilePath ? (
                  <FileViewer path={selectedFilePath} />
                ) : (
                  <div
                    style={{
                      padding: 24,
                      fontSize: 13,
                      color: "#9ca3af",
                      textAlign: "center",
                    }}
                  >
                    Select a file to view its contents
                  </div>
                )}
              </div>
              </div>
            </div>
          )}
        </div>
      </ErrorBoundary>
    </div>
  );
}
