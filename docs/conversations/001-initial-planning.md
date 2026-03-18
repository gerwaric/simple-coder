# Initial Planning Session
**Date:** 2026-03-18

## Decisions Made
- [ADR-001: Architecture Overview](../decisions/001-architecture-overview.md)
- [ADR-002: Zero Tools Baseline](../decisions/002-zero-tools-baseline.md)
- [ADR-003: Thinking Tokens in Protocol](../decisions/003-thinking-tokens.md)
- [ADR-004: Protocol Extensibility](../decisions/004-protocol-extensibility.md)
- [ADR-005: Sub-Agent Design](../decisions/005-sub-agent-design.md)
- [ADR-006: Agent Authentication](../decisions/006-agent-authentication.md)
- [ADR-007: Documentation Workflow](../decisions/007-documentation-workflow.md)
- [ADR-008: CLAUDE.md Principles](../decisions/008-claude-md-principles.md)

## Discussion

### Reading the Project Definition

Claude read docs/project-definition.md and presented an initial understanding of the three-component system: server (API + DB hub), agent daemon (headless, connects outward, streams events), and UI (reactive, real-time view of agent work).

### Stack Selection

**Claude:** Presented recommendations: Vercel AI SDK for LLM provider flexibility, React + Vite for UI, Fastify or Hono for server, Postgres for DB, WebSocket for real-time transport, pnpm workspaces monorepo, tsup for builds.

**Tom:** Can we make a choice that will allow us to also use llama.cpp or other local model providers?

**Claude:** Vercel AI SDK is the right call. It provides a unified interface with swappable providers — Anthropic, OpenAI, Google, and critically, any OpenAI-compatible endpoint which llama.cpp serves. One interface, user picks their provider via env vars.

**Tom:** What do you think about react vs svelte?

**Claude:** For this project, React + Vite. Reasoning: the reviewers at HumanLayer almost certainly know React, so they can evaluate your code easily. Svelte is lovely but adds friction for reviewers. React + Vite is dead simple without Next.js baggage.

**Tom:** Let's go with hono for its simplicity.

**Claude:** Agreed.

**Tom:** I have no thoughts on real-time transport because I'm new to this part of the tech stack.

**Claude:** WebSocket everywhere. The agent must use an outbound connection anyway (no open ports), and WebSocket gives us bidirectional communication on that single connection. For UI↔Server, WebSocket also — simpler than having two different transport mechanisms.

### Minimal Agent Design

**Tom:** I'm thinking we should start with the SIMPLEST possible coding agent. If you read the description, this project is looking for thoughtfulness and features.

**Claude:** Recommended two tools to start (readFile, writeFile) with a simple ReAct loop.

**Tom:** I want to start with a simple multi-turn conversational chat agent with ZERO tools, which gives a base to experiment from — both using traditional coding tools as well as some unconventional ideas. Instead of giving the agent "readFile", I'm thinking of giving the agent an "ask()" tool that triggers a subagent to dispatch requests, e.g. "ask('What are the contents of README.md')" or "ask('What are deployment options for a dockerfile project')".

**Claude:** Honest take: I think this is the right call, and here's why. The infrastructure is the hard part. WebSocket plumbing between three containers, real-time sync to a database, reactive UI, docker-compose that "just works" — that's 80% of the engineering. The agent loop itself is the easy part. Starting with zero tools forces you to get all the plumbing solid before layering complexity on top. The spec explicitly says they're evaluating how you approach and design, not feature completeness. The ask() idea is genuinely interesting. It's a level of indirection that decouples the agent's reasoning from specific tool implementations.

### Session Model

**Tom:** Tell me more about session models and what our options are.

**Claude:** Option A: Single-prompt — User submits a prompt, agent runs to completion. Like a fire-and-forget task. Option B: Conversational — User can send follow-up messages during or after agent execution. Option C: Tabs/workspaces — Multiple sessions visible simultaneously.

Recommended Option A for simplicity, but Tom wanted multi-turn from the start.

**Tom:** I do want to get to multi-step conversations, but I also want to start with a simple baseline.

**Claude:** Adjusted to multi-turn from the start. This is actually simpler in some ways — the session just accumulates messages, and the UI shows a chat thread. No concept of "done" to manage.

### Multiple Session Handling

**Tom:** How would the user of this agent handle multiple sessions? Is there a standard approach a developer would expect, or are there options?

**Claude:** Option A: Session list + detail view (Discord/Slack/ChatGPT pattern). Option B: Single active session. Option C: Tabs/workspaces. Recommended Option A, stripped down — a session list view showing sessions with status, click to see conversation, new session button, stop button.

Also raised the question: can one agent handle multiple sessions simultaneously, or one at a time? Recommended one-at-a-time for simplicity. The server queues pending sessions; the agent picks up the next one when free. Multiple agent containers could connect to scale horizontally.

### Reading Between the Lines of the Spec

**Tom:** Let's do one more step back and think about the plan relative to the project. I want to make sure we've thoughtfully addressed the intent of the HumanLayer project — both stated and implied.

**Claude:** Re-read the spec carefully. Key findings:

Directly stated: "sessions" (plural) throughout — multiple sessions expected. "Running sessions" synced to client in live-time. Server "manages a database" and "provides an API" — server is the orchestrator.

Implied: The agent "receives user-requested sessions from the server" — server dispatches sessions to agents, job queue pattern. Agent is a separate container in a "private sandbox" — agents are fungible workers. "Sync-driven" used twice, deliberately — they care about this.

Also flagged: "Streams events (tool calls, thinking tokens, assistant messages)" — the spec explicitly lists three event types. Our protocol should be designed to accommodate all three even if we don't emit them all yet. And "runs the sessions on the host it's running on" implies the agent does actual work on the machine.

HumanLayer's product is about putting humans in the loop for AI agent actions. The assessment mirrors their architecture. The "stop session" requirement is literally human-in-the-loop control. The ask() meta-tool idea aligns with their product vision.

### Thinking Tokens

**Tom:** Should we also allow for thinking messages as part of the sync-driven methodology? What would the impact on the system of streaming responses look like?

**Claude:** Some LLM providers (notably Anthropic with extended thinking) expose the model's internal reasoning as a separate stream. The Vercel AI SDK supports this via streamText's reasoning stream.

Impact on each layer:
- Protocol: minimal — add thinking:token and thinking:complete message types, same pattern as assistant tokens
- Agent: small — Vercel AI SDK's streamText returns both textStream and reasoningStream, iterate both
- Server: zero impact — already a dumb relay
- Database: one decision — persist thinking? Yes, as a nullable thinking column on messages table. Spec says events are "saved to the database"
- UI: small — show thinking as collapsible/dimmed section above response

Net assessment: low effort, high signal to reviewers. Shows understanding of the full event model.

**Tom:** I agree with all that. Please update the plan.

### Sub-Agent Architecture

**Tom:** Does the system we are building support our agent calling sub-agents, and/or making LLM calls as tool calls if we decide to add that kind of functionality?

**Claude:** Yes, but visibility is the interesting question. Two levels:

Level 1: Opaque sub-agents — agent makes internal LLM calls, user only sees final result. Works today with zero changes.

Level 2: Transparent sub-agents — user watches sub-agent work in real-time, nested inside parent's stream. Would need protocol additions like scoped events with parentId or depth field.

Recommendation: don't build either now, but make one structural decision — the agent's LLM client should be standalone and reusable, not coupled to the WebSocket connection. LlmClient is already separate from connection.ts. A sub-agent would just be another LlmClient instance with a different system prompt.

### Agent Authentication

**Tom:** Let's talk about auth more. From what you can determine from the project's use case, is auth something that we should skip because it won't be needed, or could it be an implicit requirement?

**Claude:** The system has a server on a port, UI talking to it, agents connecting via WebSocket. In production, absolutely needs auth. For this assessment running on localhost in Docker — full auth would be over-engineering.

Middle ground: Agent authentication via shared secret. Without this, anyone who can reach the server's WebSocket can register as an agent and receive session data. A simple AGENT_SECRET in .env, sent during agent:register, is minimal effort and meaningfully improves the architecture. This is the real trust boundary.

Retrofit cost comparison: agent shared secret is 5 min baked in vs 15 min retrofit. Full user auth is 2-3 hours either way.

**Tom:** Yes.

### Documentation Strategy

**Tom:** I would like to document this plan as well as our conversation about it, so it's part of the git history.

**Claude:** The conversation itself isn't stored as a file we can access. Recommended both: the plan becomes docs/implementation-plan.md (technical spec), and we add docs/design-decisions.md capturing the reasoning.

**Tom:** Let's choose a documentation structure that will stay organized as we have more chats.

**Claude:** Presented options: A) single evolving doc, B) numbered ADRs, C) phase-based, D) topic-based. Recommended Option B (ADRs) with lightweight structure.

**Tom:** Does that format allow us to capture the nuance of our conversations well?

**Claude:** Honestly, not great. ADRs capture conclusions but flatten the back-and-forth reasoning. Proposed a hybrid: docs/decisions/ for ADRs (the conclusions) plus docs/conversations/ for narrative summaries (the journey). Each conversation note lists its ADRs; each ADR links back to its source conversation.

**Tom:** Yes, I'd like to have both. Is there a way to automate generating these files?

**Claude:** Proposed a /conversation-notes skill that generates both artifacts from the current conversation in a single command. The conversation notes capture the journey, the ADRs extract the decisions.

**Tom:** What about having ADRs created as part of the conversation-notes command, so if we change our mind back and forth, only the final decision gets an ADR while the dialog can be described in the conversation note?

**Claude:** That's a cleaner workflow. One command, two outputs, and the ADR is always grounded in the conversation that produced it. Bidirectional traceability with a single command.

**Tom:** I want the conversation notes to be as "unsummarized" as possible.

**Claude:** Important distinction. The conversation notes should be near-verbatim — reproduce exchanges close to verbatim, keep questions as asked, preserve dead ends and reversals. Only add minimal structural markup. Let the ADRs do the summarizing.

### Testing Strategy

**Claude:** Raised testing as a minor topic — spec doesn't require tests, but having a few shows rigor. Proposed: skip unit tests, add integration tests validating the session lifecycle.

**Tom:** Yes, let's add some basic deterministic tests. These could also be helpful in the future if we want to make infra changes and check for regressions.

### CLAUDE.md Alignment with HumanLayer Principles

**Tom:** Please read the HumanLayer blog post about writing a good CLAUDE.md and think about how it applies to ours.

**Claude:** Read the article. Key principles: structure around WHY/WHAT/HOW, keep under 60 lines, progressive disclosure (point to docs rather than inline), only universally applicable instructions, never use LLMs as linters.

Assessment of our CLAUDE.md: missing the WHY (assessment context), missing the HOW (build commands), too much non-universal detail (documentation conventions), design principles that are code-discoverable. Revised to 30 lines with WHY/WHAT/HOW structure, progressive disclosure to docs/, moved documentation conventions into the skill itself.

### Commit Strategy

**Tom:** I prefer smaller more contained commits.

**Claude:** Agreed on sequence: Commit 1 (plan + docs structure), Commit 2 (conversation notes + ADRs), Commit 3 (Phase 0 scaffolding), then one or more commits per implementation phase.
