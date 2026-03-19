import { useSessions } from "./hooks/useSessions";
import { SessionList } from "./components/SessionList";
import { ChatPanel } from "./components/ChatPanel";

export function App() {
  const {
    sessions,
    selectedSessionId,
    setSelectedSessionId,
    messages,
    streamingThinking,
    streamingContent,
    createSession,
    sendMessage,
    stopSession,
  } = useSessions();

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || null;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
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
          onSend={sendMessage}
          onStop={stopSession}
          onCreateSession={createSession}
        />
      </div>
    </div>
  );
}
