import { useSessions } from "./hooks/useSessions";
import { SessionList } from "./components/SessionList";
import { ChatPanel } from "./components/ChatPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";

export function App() {
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
              onSelect={(id) => setSelectedSessionId(id)}
              onNew={() => setSelectedSessionId(null)}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <ChatPanel
              session={selectedSession}
              messages={messages}
              streamingThinking={streamingThinking}
              streamingContent={streamingContent}
              summaries={summaries}
              contextGauge={contextGauge}
              onSend={sendMessage}
              onStop={stopSession}
              onCreateSession={createSession}
            />
          </div>
        </div>
      </ErrorBoundary>
    </div>
  );
}
