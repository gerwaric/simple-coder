# Coding Agent Design Brainstorm
**Date:** 2026-03-19

## Decisions Made
- [ADR-010: Agent Tool Architecture](../decisions/010-agent-tool-architecture.md)
- [ADR-011: Code Workspace Model](../decisions/011-code-workspace-model.md)
- [ADR-012: Context Management Model](../decisions/012-context-management-model.md)
- [ADR-013: Flat Message Model for Tool Calls](../decisions/013-flat-message-model.md)
- [ADR-014: Own Agent Loop](../decisions/014-own-agent-loop.md)
- [ADR-015: Approval Flow Design](../decisions/015-approval-flow-design.md)
- [ADR-016: WebSocket Protocol Extension](../decisions/016-websocket-protocol-extension.md)
- [ADR-017: Dynamic System Prompt](../decisions/017-dynamic-system-prompt.md)

## Discussion

### Approaches to Evolving into a Coding Agent

**Tom:** We are at the point where I have the basic infrastructure up and running with a conversational multi-turn agent with thinking tokens. Currently there are no tools. For this conversation, I want to discuss possibilities for evolving this into a coding agent. I think there are different approaches to it, such as giving the main agent a complex prompt with many coding-related tools, vs having the main agent primarily dispatch tasks to sub-agents or tools. I want to brainstorm different approaches before we even start designing things. Keep in mind the stated project definition included both explicit as well as between-the-lines inferrable objectives.

**Claude:** Identified the meta-objective: HumanLayer's product is about human oversight of AI agent actions, so the architecture chosen for tooling is itself the thing being evaluated. Presented five approaches:

1. **Fat agent — one loop, many tools.** The Claude Code / Aider model. Simple but no natural point for human oversight except "approve every tool call," which gets noisy.

2. **Orchestrator + specialized sub-agents.** Main agent is a planner/router dispatching to sub-agents. Clean separation of concerns, natural approval boundaries, but significantly more complex.

3. **Plan-then-execute with approval gate.** Two phases: plan (reads code, proposes changes) then execute (carries out approved plan). This is exactly the HumanLayer value proposition. Simple to implement but rigid.

4. **Tiered trust — safe tools automatic, dangerous tools need approval.** Classify tools as safe (reads) vs consequential (writes). Pragmatic, maps directly to how HumanLayer's product works. But classification can be fuzzy.

5. **Hybrid: minimal tools + plan/approve + extensible.** Combines 1 + 3 + 4. Small tool set, plan before writing, server holds consequential actions for approval. Implementation minimal, design shows the full vision.

Noted that a clean approval-gated architecture with 3 tools beats a sprawling agent with 15 tools, given the assessment criteria.

### Where Does the Code Live?

**Tom:** We also need to consider where the code this agent will work on comes from, and where it will live. What makes sense given the current architecture?

**Claude:** Presented three options:

- **Option A: Code lives in the agent container.** The agent container has a workspace directory. File tools operate on the agent's local filesystem. Results stream back through WebSocket. The code never needs to live on the server. This is the natural fit — the agent already runs in ubuntu with no exposed ports, that's a sandbox.

- **Option B: Code lives on the server, agent fetches/pushes.** Fights the architecture. Turns the server into a file server.

- **Option C: Code is mounted via Docker volume.** Practical for real use but complicates the "just run docker compose up" requirement.

Recommended Option A with a twist: the agent clones a repo at session start (user provides a URL) or comes with a sample project baked in for demo.

**Tom:** Yes, I like option A. We need to remember to make sure the agent has a way to clone the repo. My thought is that we need to make sure it can call git (either via a CLI or via bash).

**Claude:** Agreed, and noted this starts to answer the tooling question — if the agent needs git clone, it needs shell access. Once you have shell access, you get a lot of coding capability for free: git operations, cat/ls/find/grep for exploration, language toolchains, test runners.

### Tool Set Design — The Spectrum

**Claude:** Raised the key design question: do you implement read_file, write_file, search as separate tools, or just give the agent a bash tool and let it do everything through shell commands?

Presented the spectrum:

- **Minimal: just bash.** One tool, agent can do anything. But raw stdout/stderr, hard to present nicely in UI or create meaningful approval gates.

- **Maximal: many purpose-built tools.** Structured I/O, nice UI rendering, granular approval. But a lot more to implement.

- **Middle ground: bash + a few structured tools.** bash for general-purpose work including git, plus read_file and write_file for clean UI rendering and approval seams.

**Tom:** I like the middle ground option. Let's keep that in mind as we keep talking.

### Authentication and Secrets

**Tom:** I'm also wondering about authentication and env secrets. Since we don't really have a direct file editor, what are some approaches we could use to securely making user-defined secrets available to the agent — like those the .env file might provide?

**Claude:** Presented three approaches:

1. **Extend the existing .env pattern.** Already how the project passes LLM_API_KEY and AGENT_SECRET. Zero new infrastructure. Reviewer just adds keys to .env.

2. **Pass secrets at session creation.** Per-session flexibility but secrets flow through the server and database — need encryption at rest, not logging them. More complexity for single-user localhost.

3. **Agent-side config file.** Mount a config file via Docker volume. No real benefit over option 1 for this use case.

Recommended option 1. The threat model doesn't call for per-session secret isolation.

**Tom:** Let's pass them in via the .env file.

### Agent Organization Models

**Tom:** I want to brainstorm ways to organize our agent at a high level. For example, is the agent chatting with the user responsible for making design decisions and planning, for reading and writing files, for asking the user questions? I have been trying to think about how we might structure things — e.g. giving the agent an ask() tool and an act() tool, where ask() either queries the human user, the code base, or the internet and the act() tool makes a change. I also want to think about ways to make context management a part of this design, either by exposing it to the user, or to the agent, or creating context-related tools.

**Claude:** Explored several angles:

**The ask() / act() split:** Pushed on the semantics — the real boundary isn't ask/act, it's **observe vs mutate**. Observe is anything that doesn't change state (read files, search, ask the user). Mutate is anything that changes state (write files, run commands). Observe is always safe, mutate always needs consideration. That's the approval boundary.

**Single agent with role phases:** The agent moves through understand → explore → plan → execute → verify phases. Same agent, same context, but the system prompt or available tools shift per phase. Gives structure without requiring sub-agents.

**Orchestrator with capability tools:** Main agent is a conversationalist and planner with high-level tools: ask_user(), explore(), propose_plan(), execute_step(). The explore() tool could be a context-managed sub-call — a separate LLM invocation with a focused context window that returns a summary.

**Context management approaches:**

- **Implicit:** Agent works until context runs out. Fine for short tasks.
- **Summarize-and-compact:** When context gets large, summarize and start fresh.
- **Context as an explicit resource — tools for it:** scratch_pad(write, key, content), scratch_pad(read, key), explore() in a sub-context. The scratch pad is visible in the UI. The user can see what the agent chose to remember — natural place for human oversight of the agent's understanding.
- **Expose context to the user:** UI shows context usage, what's in it. User can intervene ("drop the file contents from earlier").

### What's in the Current Agent State

**Tom:** What's currently in the state that gets passed between calls?

**Claude:** Investigated the codebase. Currently:

- **System prompt:** "You are a helpful coding assistant." (hardcoded in llm.ts)
- **Message history:** Full conversation as Message[] — role and content only. Thinking is captured and streamed to UI but NOT included in subsequent LLM calls.
- **LLM config:** provider, model, thinking budget from env vars.

No tool state, no scratch pad, no file contents, no plan. Context is purely raw conversation history growing unboundedly. Every file the agent reads will live in the message history as text — context fills up fast. No mechanism to forget or summarize.

### Context Management Deep Dive

**Tom:** I want both the agent and human enough visibility so they can make decisions based on the state of the context window, and maybe even manipulate it.

**Claude:** Proposed the state model needs to become richer:

1. **Message types expand** — tool calls, tool results, plan messages, scratch pad entries. Align with Vercel AI SDK conventions.

2. **Context budget becomes first-class** — token count of current history, remaining budget, what's taking up space. Tracked by agent, reported to server, shown in UI.

3. **Context manipulation primitives:**
   - Agent-side: scratch_pad(), summarize_and_drop()
   - Human-side: see what's in context with token counts, pin messages, drop/collapse messages, inject context
   - Server-mediated: compaction before forwarding

Proposed a concrete state model:
```
Session State
├── conversation[]        — messages the LLM sees
├── scratch_pad{}         — key-value store, outside LLM context
├── context_budget        — max/used/remaining tokens
├── pinned_message_ids[]  — never auto-compacted
└── plan                  — current plan with step status
```

### How Other Coding Agents Handle Context

**Tom:** How do standard coding agents handle this? Is there one industry standard approach, or do different agents have their own takes?

**Claude:** Different agents have meaningfully different approaches. No single standard.

- **Claude Code:** Summarize-and-compact. When context gets large, compress history into summary, continue fresh. User can trigger with /compact.
- **Cursor / Windsurf:** Retrieval-based. Index codebase externally (embeddings, ASTs), pull relevant snippets on demand. Context assembled fresh per turn like a RAG pipeline.
- **Aider:** Chat history + repo map. Repo map is condensed view of codebase (function signatures, class outlines). Explicit /add and /drop commands for file context.
- **OpenAI Codex CLI:** Sandboxed execution. Context scoped to task, less emphasis on long-running conversation.
- **SWE-Agent:** Window-based file viewer. Agent sees a scrollable viewport, uses scroll_up/scroll_down/goto_line. Keeps file content in context small.

Common patterns: summarize & compact, retrieval/RAG, repo map, file viewport, add/drop files, scoped tasks.

For this project: compact + user-visible context borrows the best ideas without heavy infrastructure. The scratch pad could be the repo map.

### Simplifying Context Management

**Tom:** I want something simple and flexible, where both the agent and user can view and manipulate the context window.

**Claude:** Presented five ideas:

1. **Token counter + compact command.** Simplest useful thing. Gauge in UI, "Compact" button.
2. **Message-level visibility with drop/keep.** Each message with token weight, user marks as drop/keep.
3. **Scratch pad as context overflow.** Key-value store outside LLM context, visible in UI side panel.
4. **Context as a shared document.** Reframe — context window is a shared editor both sides can manipulate.
5. **Budget-aware agent instructions.** Tell the agent its budget in the system prompt, agent self-manages.

Suggested combining: token gauge (1), scratch pad (3), budget in system prompt (5), user compact button (1).

**Tom:** Let's go with a simple text-only context display. No scratch pad in our current design unless I'm wrong. I was thinking to avoid a key-value based scratchpad.

**Claude:** Agreed to cut the scratch pad. The context management system (active/summarized/inactive) already gives the agent a way to manage what's in context. A scratch pad would be a second mechanism for a similar purpose. If the agent wants to remember something concisely, it can summarize messages down. The summarized content is the notes.

### Making Message History Selectable

**Tom:** Is there a way to make the message history selectable, so the agent (or human) could selectively forget or compact messages?

**Claude:** Yes, and it fits naturally into the existing architecture. Messages already have IDs. Add a `contextStatus` field:

- **active** — included in LLM calls (default)
- **dropped/inactive** — excluded from LLM calls, still visible in UI (grayed out)
- **summarized** — replaced by a summary message, original preserved in DB

The distinction between "what the LLM sees" and "what the UI shows" is key. The database keeps everything. The context window is a view over that history.

Agent-side: a context tool with drop, summarize, activate, status actions.
User-side: UI shows all messages (including dropped/summarized ones, visually distinct), click to drop/restore.

**Tom:** Each message will have its original contents in the DB, and it can be selected or deselected by either the user or the LLM. Messages can also be summarized, but we should keep both the summary and the original message for the user/LLM to switch between.

**Claude:** You're essentially creating a non-destructive editing model for context — like layers in Photoshop. Nothing is ever lost, you just choose which version to show the LLM.

Each message has: original content (immutable), summary (optional, created on demand), active version (which the LLM sees: original, summary, or none).

Discussed who creates summaries, granularity (single vs group), who triggers the switch, token counting for summaries.

### Database Design for Group Summarization

**Tom:** For group summarization, how would this affect the database design? Seems like we might need a separate table for summaries since each summary might reference multiple messages.

**Claude:** Right, a summary is its own entity with a many-to-many relationship:

```
summaries
├── id, session_id, content, token_count, created_by, created_at

summary_messages (join table)
├── summary_id, message_id
```

Messages get a `context_status` field ('active' | 'summarized' | 'inactive') and `token_count`.

Context assembly: get all messages ordered, include active ones, replace summarized groups with their summary at the position of the first message in the group, skip inactive ones.

### Preventing Overlapping and Nested Summaries

**Tom:** Can we deterministically prevent overlapping summaries and summaries-of-summaries to keep things simpler?

**Claude:** Yes. Two simple rules:

**Rule 1:** A message can only belong to one summary. Unique constraint on message_id in the join table.
**Rule 2:** Only active messages can be summarized. Since summarized messages have context_status = 'summarized', you can never summarize something already in a summary.

To re-summarize a range: restore the original messages (set back to active, delete the old summary), then create a new summary. No complex graph traversal, no recursion, no edge cases.

### The Multi-Step Turn Problem

**Claude:** Identified this as the biggest design impact question. Currently a turn is: user message → agent calls LLM → streams thinking + text → done. With tools, a single user message might trigger: thinking → text → tool call → tool executes → tool result → more thinking → more text → another tool call → ... → final response. It's a loop, not a single pass.

This affects the WebSocket protocol (new message types), the agent loop (loop until no tool calls), the database schema (a turn is a sequence of messages), the UI (render multi-step turns), the approval flow (interrupt the loop), token counting (multiple LLM calls per turn), and context management (history growing within a turn).

### Flat Message Model

**Tom:** I'd like to look for a simple well-designed solution that will be straight-forward to implement/troubleshoot/expose-in-the-ui.

**Claude:** What if every step is just a message? A turn becomes a sequence of messages in the same table:

```
user message          (role: user)
assistant text        (role: assistant)
tool call             (role: tool_call, tool: read_file, args: {...})
tool result           (role: tool_result, content: "file contents...")
assistant text        (role: assistant)
tool call             (role: tool_call, tool: write_file, args: {...})
tool result           (role: tool_result, content: "success")
assistant text        (role: assistant, "Done...")
```

Each is a row in the messages table, ordered by createdAt. The UI renders them sequentially. No "turns" or "steps" as separate entities. Context management still works — every message has an ID and contextStatus.

Approval slots in naturally — tool call persisted with approvalStatus 'pending', UI renders approve/reject buttons, agent loop pauses.

The Message type expands:
```typescript
interface Message {
  id, sessionId, role, content, thinking,
  toolName, toolArgs, toolCallId,
  contextStatus, approvalStatus, tokenCount,
  createdAt
}
```

**Tom:** This sounds good.

### The ask_human Tool

**Tom:** What if we give the agent an ask_the_human() tool? Will it already understand that it should stop when it has a question, making this redundant, or will that encourage the human layer?

**Claude:** An explicit ask_human tool adds real value. Without it, the agent might ask a question in text and keep going before the user sees it. The UI has no way to distinguish "asking and waiting" from "narrating."

With the tool: the agent loop pauses (same mechanism as approval), the UI renders a prompt card with an input field, the server knows the session is in "waiting for human" state, and the user's response goes back as the tool result.

It also encourages the agent to ask rather than guess — asking the human is a real option alongside bash and read_file. And it's deeply aligned with HumanLayer's product: the agent choosing to involve the human at a decision point.

Five tools total, two involving human interaction:

| Tool | Category | Blocks for human? |
|------|----------|--------------------|
| bash | workspace | only if mutating (approval) |
| read_file | workspace | no |
| write_file | workspace | yes (approval) |
| context | meta | no |
| ask_human | collaboration | yes (waiting for response) |

### Vercel AI SDK Alignment

**Claude:** Raised the question of whether to use Vercel AI SDK's built-in tool loop or run our own. The SDK can auto-loop tool calls, but we'd lose control over when to pause for approval or ask_human.

Recommended running our own loop: call LLM → if tool call, handle it (execute or pause for approval) → call again → repeat until no tool calls. The approval and ask_human pauses are core to the design.

Use Vercel for streaming and provider abstraction. Pass tool definitions through Vercel's tools parameter. Own the orchestration.

**Tom:** Yes, and I think running our own loop is aligned with the hidden intent of the project.

**Claude:** Agreed. The assessment wants to see you design an agent loop, not wrap someone else's.

### Tool Execution Patterns

**Claude:** Four tools execute locally (bash, read_file, write_file, ask_human). The context tool modifies message state in the database — that data lives on the server.

Presented three options for context tool execution:
- A: Agent sends tool call to server, server executes
- B: Agent calls server HTTP API (e.g. PATCH /api/messages/:id/context-status)
- C: Agent manages locally, syncs to server (split-brain problem)

Recommended B. The UI uses the same API endpoints. One source of truth (DB), two clients (agent and UI), both through the same API. When either side changes, server broadcasts over WebSocket.

**Tom:** Agreed. B.

### User Context Controls

**Claude:** Since both agent and user use the same HTTP API, the UI needs: each message gets a drop/restore toggle, and a summarize option for multi-select.

For user-initiated summarization, who writes the summary? Options: agent writes it (interrupts current work), separate LLM call (server needs LLM access), user writes it manually, or defer to agent's next turn.

**Tom:** I'm thinking about disallowing user summarization at first. Does that actually save us any complexity?

**Claude:** Not much. The summary creation is the same code path regardless. Drop and restore are the high-value user controls. If they want something summarized, they can ask the agent via chat. Cut user summarization for now. User gets drop/restore, agent gets the full context tool including summarize.

### Approval Safety Check

**Claude:** For the assessment demo, shipping with a simple rule rather than a blanket "approve everything" placeholder shows the feature in action:

```typescript
function assessToolCall(tool, args) {
  const safeTools = ['read_file', 'context', 'ask_human'];
  return { allowed: safeTools.includes(tool) };
}
```

Bash always needs approval, write_file always needs approval, the rest execute freely.

**Tom:** Yes, let's do require approval for bash and write for now.

### WebSocket Protocol Extension

**Claude:** Reviewed existing ws-messages.ts. tool:call and tool:result already exist. New types needed:

Agent → Server: tool:approval:request
Server → Agent: tool:approval:response, context:updated
Server → UI: tool:approval:request, context:updated, context:status

For UI→Server direction: keep UI WebSocket one-directional (server→UI broadcast only). Approvals go through HTTP (POST /api/tools/:callId/approve), server relays to agent via WebSocket. Consistent with current design — REST API is write path, WebSocket is read path.

**Tom:** I'm torn. What might be a good way to decide this based on the overall project context?

**Claude:** The assessment values design thinking. Explicit types say "these are semantically distinct operations and I modeled them that way." The type system documents the protocol — a reviewer reading the type definitions understands every interaction without reading implementation code. The cost is a few more interfaces, which in a project this size is documentation, not complexity.

**Tom:** Yes, let's go with new types.

New HTTP endpoints needed:
- POST /api/tools/:callId/approve
- POST /api/tools/:callId/reject
- POST /api/tools/:callId/respond (for ask_human)
- PATCH /api/messages/:id/context-status

### Error Handling

**Claude:** When a tool fails, the error becomes the tool result. The LLM sees the error, adjusts, tries something else. No special error message types, no special UI rendering needed, the agent loop doesn't break. A try/catch around tool execution converts any exception into an error tool result.

**Tom:** KISS.

### Dynamic System Prompt

**Claude:** The system prompt needs to be assembled fresh before each LLM call.

Static parts: role definition, behavioral guidelines (when to ask the human vs act independently).
Dynamic parts: context budget ("~45,000 of 128,000 tokens"), working directory state, session status.

Tool descriptions go through Vercel's tools parameter, not the system prompt.

Workspace state: keep minimal — just what's been cloned and cwd. The agent can ls if it needs more.

Phase-based prompt changes: keep simple — one prompt with conditional lines. When context is high, add a warning. Not a phase system.

**Tom:** I would like us to duplicate the behavioral context at the end of the prompt, since that helps LLMs perform better according to some research I've seen.

**Claude:** Makes sense — the "lost in the middle" problem. A short reinforcement section at the end:

```
Reminders:
- Use ask_human when uncertain — don't guess
- Mutating actions require approval
- When context exceeds 70%, summarize or drop old messages
- Keep the user informed of what you're doing and why
```

Top has full explanation, bottom has condensed rules. The reminders section is a short static list.

**Tom:** Let's start with a short static list for now.

### UI Approach

**Claude:** New message types to render: tool calls (show tool name + args), tool results (code blocks, terminal output), approval prompts (approve/reject buttons), ask_human prompts (question + text input).

Context controls: context gauge, drop/restore per message, visual distinction for summarized messages.

Layout options: (1) everything inline in chat with context gauge in header, (2) chat + side panel for context status.

**Tom:** Let's go with option 1, simple text-only context display.

### Remaining Open Issues

**Claude:** Identified four: WebSocket message types (resolved — new explicit types), context budget reporting to UI, error handling (resolved — KISS), and implementation ordering.

Worked through all remaining questions to resolution.

### Implementation Planning and Documentation

Tom and Claude worked through creating the implementation plan, phased prompts, conversation notes, and ADRs for the coding agent design. Created `docs/coding-agent-plan.md` with six phases (8–13), phased prompts (009–014), and updated progress tracking.

### Top-Down Review of the Plan

**Tom:** Please do a top-down review. I would like to make sure there are no critical issues we need to discuss right now. It's ok if questions come up during implementation. Basically I'm thinking this should be a sanity check and general review for gaps/contradictions/etc.

**Claude:** Reviewed all documentation systematically. Found two critical issues and four smaller items:

**Critical issue 1: Missing summary creation endpoint.** Phase 9 defined endpoints for approval and context-status, but no endpoint for creating a summary. The context tool's summarize action needs `POST /api/sessions/:id/summaries`. Phase 10 even noted this vaguely but Phase 9 didn't define it.

**Critical issue 2: ask_human has a three-way execution path, but the safety check is binary.** The safety check returned `{ allowed: boolean }` — safe tools execute locally, unsafe tools go through approval. But ask_human is marked as "safe" yet doesn't execute locally — it blocks for a user text response. That's a third path. The safety check needs a richer return type like `{ action: "execute" | "approve" | "ask_human" }`.

**Smaller items:** (3) Existing ToolCall/ToolResult WS interfaces need a `toolCallId` field added. (4) `maxTokens` for the context gauge needs a source — decided on an env var. (5) Message UUID generation — who generates the ID when the agent creates tool_call messages? (6) UI needs summary data when rendering summarized messages.

**Tom:** Please fix 1-3 as suggested. And yes, let's make max tokens an env variable for now. What do you think about the UUID generation? Is one option cleaner and a better fit to our design than the other? Also, what is your take on how to address 6?

**Claude:** Agent-side generation with `crypto.randomUUID()` is the better fit. The agent needs the toolCallId immediately — it generates a tool_call message and then needs that ID to link the tool_result. If the server generates the ID, the agent has to wait for a round-trip before it can proceed. Agent generates locally, server accepts the provided ID. Simple, no round-trips, and UUIDs don't collide.

For issue 6: the cleanest approach is to include summaries in the existing `GET /api/sessions/:id` response. This endpoint already returns messages. Add a summaries array to the response. The UI has everything it needs in one fetch. No separate endpoint, no extra round-trip. When a summary is created or deleted, the `context:updated` WebSocket message already notifies the UI to refetch or update its state.

**Tom:** Agreed on both.

Claude applied all six fixes to the plan and phased prompts:
1. Added `POST /api/sessions/:id/summaries` endpoint to plan and Phase 9 prompt
2. Changed safety check from `{ allowed: boolean }` to `{ action: "execute" | "approve" | "ask_human" }` in plan and Phase 10 prompt
3. Added `toolCallId` to existing ToolCall/ToolResult WS interfaces in Phase 8 prompt
4. Added `LLM_MAX_TOKENS` env var to plan, Phase 10, and Phase 12 Docker prompt
5. Documented agent-side UUID generation via `crypto.randomUUID()` in plan and Phase 10
6. Added session response includes summaries to plan and Phase 9 prompt
