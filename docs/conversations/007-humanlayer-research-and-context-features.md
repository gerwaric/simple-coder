# HumanLayer Research and Context Engineering Features
**Date:** 2026-03-22

## Decisions Made
- [ADR-030: User-Initiated Summarization](../decisions/030-user-initiated-summarization.md)
- [ADR-031: CLAUDE.md Prepend to Context](../decisions/031-claude-md-prepend.md)

## Discussion

### HumanLayer Research

**Tom:** Please read the README, project definition, and progress to understand this project, then investigate this project's sponsor: HumanLayer.dev and its founder Dex Horthy. I want you to create a dossier in the project docs that captures information about HumanLayer relevant to this project. This will require searching the internet for blog posts, and then thinking about what their view of this project is. For context, I'm at an AI bootcamp and several of us have been assigned this project and interviews with HumanLayer. The project is at a very minimal MVP state, and I want to think about what to do next.

**Claude:** Launched two research agents in parallel to investigate HumanLayer.dev and Dex Horthy. The HumanLayer agent errored out, but the Dex Horthy agent returned comprehensive results covering both. Created `docs/humanlayer-dossier.md` with:

- Company overview (YC F24, evolved from approval SDK to CodeLayer IDE)
- Dex Horthy's background (NASA JPL, Replicated, HumanLayer)
- Key published works: 12-Factor Agents framework, ACE-FCA methodology
- Core philosophy: "you cannot outsource the thinking," context engineering, spec-first development
- Assessment mapping: what the project already does well vs. gaps, mapped to his published principles
- Interview talking points and recommended next steps

Key finding: the project already aligns well with several 12-Factor Agent principles (stateless broker, human-in-the-loop as first-class, own your context window, own your control flow). The 26 ADRs are a strong signal for "design thinking and architecture" which is the stated evaluation criteria.

### Brainstorming Context Engineering Depth

**Tom:** Can you help me brainstorm the context engineering depth piece. What I have so far is giving both the user and the agent visibility into the context window (as exposed in the UI with the selectable messages). I'm not sure if I should try to work out a demo flow that showcases this feature, or come up with another feature. There's not a lot of time, so I want to be tactical and aim for low hanging fruit.

**Claude:** Explored the existing context management implementation across all packages. What's already built: three-state model (active/inactive/summarized), visual gauge with 70% warning, per-message green/orange context bars, agent self-manages via system prompt warnings, summaries are atomic and reversible.

Proposed four options:

- **Option A: Demo script** that showcases what's already built — craft a task that naturally fills context, show the agent hitting 70%, self-summarizing, continuing. Zero code, just a rehearsed flow.
- **Option B: User-initiated summarization** — add a "Summarize selected" button where the user selects messages and writes a summary. Small feature that demonstrates human-directed context engineering, very on-brand for HumanLayer.
- **Option C: Auto-compaction trigger** — when context hits X%, automatically compact oldest messages. Echoes ACE-FCA's 40-60% utilization target.
- **Option D: Context diff view** — show token savings when a summary replaces messages. Tiny UI addition making context engineering visible.

Recommended A + D (zero to minimal code, maximum interview impact), with B as next best if time allows because it directly demonstrates human-in-the-loop applied to context management.

### Deciding on User-Initiated Summarization

**Tom:** What is the work needed to make B happen?

**Claude:** Analyzed the codebase and found the backend already supports it — `POST /api/sessions/:id/summaries` already accepts `createdBy: "user"`. The work is UI-only:

1. ChatPanel.tsx — selection state, summarize action bar, inline summary input
2. MessageBubble.tsx — selection mode props (selectable, selected, onToggleSelect)
3. api.ts — add createSummary function

Zero changes to server, database, WebSocket, agent, or shared types. ~50-60 lines of new React code. Also recommended against LLM-generated summaries: user-written summaries are more on-brand because the human decides what matters.

**Tom:** Yes, let's do this. But remember to carefully stick with the style of decisions/prompts/conversations documentation that has been used with this project so far.

**Claude:** Implemented the feature across three files. UX flow: "Summarize..." button in gauge bar → enter selection mode → click message context bars to select → "Summarize" button → inline text input → "Save" calls existing API. WebSocket broadcasts handle UI updates automatically.

Build succeeded, all 63 tests passed.

### Button Text Refinement

**Tom:** I was able to summarize a message manually. Can we change the button text to be concise, but a little more explanatory?

**Claude:** Offered options: "Select & summarize...", "Summarize messages...", "Manual summarize..."

**Tom:** "Select & summarize messages"

**Claude:** Updated the button text.

**Tom:** Later changed to "Manually select & summarize message(s)"

### CLAUDE.md Prepend Feature

**Tom:** Can we also add a checkbox at the lower left in the session sidebar? I want a checkbox that says "Include ./CLAUDE.md". If this box is checked, I want the system to include the contents of the "CLAUDE.md" file (if it exists) before any of the other context that gets passed to the agent.

**Claude:** This required a full-stack change since the setting needs to flow from UI → server → DB → agent:

1. **shared/types.ts** — added `includeClaudeMd: boolean` to Session
2. **server/db/init.ts** — added `include_claude_md` boolean column
3. **server/db/queries.ts** — updated SessionRow, toSession, createSession
4. **server/routes/sessions.ts** — accepts flag on POST /api/sessions
5. **agent/system-prompt.ts** — prepends CLAUDE.md content when provided
6. **agent/connection.ts** — reads `/workspace/CLAUDE.md` on session assign when flag is set
7. **ui/components/SessionList.tsx** — checkbox at bottom of sidebar
8. **ui/api.ts** — updated createSession signature
9. **ui/App.tsx** + **ui/hooks/useSessions.ts** — state management and threading

The flag is stored on the session in Postgres so it survives agent reconnects. Build succeeded, all 63 tests passed.

**Tom:** Changed label to "Prepend CLAUDE.md to context if present"

### Filesystem Access Planning

**Tom:** The next thing I want to do is to think about how the user can view or access the file system. What options do we have for this?

**Claude:** Proposed four options:

1. **Shared volume + server REST API** (recommended) — mount agent's /workspace read-only in server container, add GET /api/files endpoints for listing and reading, add file tree panel in UI. Works regardless of agent connection.
2. **Agent-as-proxy** — route file requests through WebSocket. Only works when agent is connected, adds latency and complexity.
3. **Just use agent's tools** — user asks "show me the file tree" in chat. Zero code but poor UX.
4. **File change feed** — broadcast write_file events to UI. Real-time visibility but not browsable.

**Tom:** Yes, I like 1. Should we implement that in another chat session with a specific new context setup?

**Claude:** Yes, a fresh session with a focused prompt will be cleaner. Suggested running conversation-notes first to capture this session, then writing a prompt for the new session.
