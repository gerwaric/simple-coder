# Phase 4: React UI

Read `docs/implementation-plan.md` and `docs/progress.md` for full context.

## Task

Implement the React frontend: session list, chat panel, real-time streaming via WebSocket, and session management (create, stop).

## API Helpers (packages/ui/src/api.ts)

- createSession(title, message) → POST /api/sessions
- listSessions() → GET /api/sessions
- getSession(id) → GET /api/sessions/:id (returns session + messages)
- sendMessage(sessionId, content) → POST /api/sessions/:id/messages
- stopSession(sessionId) → POST /api/sessions/:id/stop

## WebSocket Hook (packages/ui/src/hooks/useWebSocket.ts)

- Connect to ws://{host}/ws/ui
- Parse incoming JSON messages by type
- Auto-reconnect with backoff on disconnect
- Return a dispatch function for handling message types

## Session State Hook (packages/ui/src/hooks/useSessions.ts)

Manage:
- sessions: Session[] — loaded on mount via listSessions(), updated by session:updated WS messages
- selectedSessionId: string | null
- messages: Map<sessionId, Message[]> — loaded when session selected, updated by message:created
- streamingThinking: Map<sessionId, string> — accumulating thinking tokens
- streamingContent: Map<sessionId, string> — accumulating response tokens

WS message handling:
- session:updated → update session in list
- message:created → append to messages for that session
- thinking:stream → append to streamingThinking
- token:stream → append to streamingContent
- message:complete → clear streaming state, append final message

## Components

**App.tsx:** Layout with sidebar (SessionList) and main panel (ChatPanel). Wires up WebSocket and session state.

**SessionList.tsx:** List of sessions showing title and status (pending/active/completed/stopped). "New Session" button. Click to select.

**ChatPanel.tsx:** Shows messages for selected session. Input field + send button at bottom. Stop button for active sessions. Handles creating new sessions (first message creates the session).

**MessageBubble.tsx:** Renders a single message. User messages on one side, assistant on the other.

**StreamingMessage.tsx:** In-progress assistant response. Shows thinking tokens in a collapsible, visually distinct section (dimmed/italic). Shows response tokens below. Replaced by MessageBubble when message:complete arrives.

## Styling

Keep it minimal — clean and functional. No CSS framework required. Plain CSS or minimal inline styles. The focus is on demonstrating real-time sync, not visual polish.

## Vite Config

Proxy /api and /ws to localhost:3000 in dev mode.

## Verification

1. `pnpm dev:ui` starts Vite dev server
2. UI loads, shows empty session list
3. Type a message and send → session created, appears in list
4. If agent is connected: thinking tokens stream in (collapsible), then response tokens stream in real-time
5. Send follow-up message → agent responds
6. Click stop → session stops
7. Create another session → works
8. Refresh page → sessions persist (loaded from server)

## On Completion

Update `docs/progress.md`. Commit with message: "Phase 4 — React UI with real-time streaming"
