# HumanLayer Dossier

Research on HumanLayer and founder Dex Horthy, compiled to inform next steps on this take-home assessment.

## HumanLayer — Company Overview

- **Founded:** 2023, San Francisco
- **Funding:** Y Combinator F24 batch
- **Website:** [humanlayer.dev](https://www.humanlayer.dev/)
- **GitHub:** [github.com/humanlayer](https://github.com/humanlayer)

**Original product:** An API/SDK for adding human-in-the-loop approval workflows to AI agents (via Slack, email, etc.). The core insight: giving AI agents unsupervised control over infrastructure is dangerous, so human approval should be a first-class primitive in agent architectures.

**Current product (CodeLayer):** Has evolved into an open-source IDE for orchestrating AI coding agents, built on Claude Code. Tagline: "Close your editor forever." Battle-tested workflows for managing coding agents at scale.

## Dex Horthy — Founder

- **LinkedIn:** [dexterihorthy](https://www.linkedin.com/in/dexterihorthy/)
- **GitHub:** [dexhorthy](https://github.com/dexhorthy) (159 repos)
- **Twitter/X:** [@dexhorthy](https://x.com/dexhorthy)
- **Substack:** [The Outer Loop](https://theouterloop.substack.com/) — "AI Agents, Human in the Loop, maybe-agi"

**Background:** Started coding at 17, built tools for NASA JPL. Spent 7 years at Replicated (Series C developer tools) spanning engineering, solutions engineering, product management, and executive roles. Worked on container orchestrators and helped companies like HashiCorp and DataStax ship on-premise Kubernetes products.

**Origin story for HumanLayer:** Was building autonomous AI agents, including one that coordinated with humans in Slack to do database cleanup (e.g., dropping Snowflake tables not queried in 90+ days). Realized that granting AI unsupervised database control was dangerously risky — that became the genesis of HumanLayer.

**Credited with popularizing the term "context engineering"** (April 2025), subsequently adopted broadly across the AI agent community.

## Key Published Works

### 12-Factor Agents

[github.com/humanlayer/12-factor-agents](https://github.com/humanlayer/12-factor-agents) — described as a "fan favorite manifesto" at AI Engineer conferences. The 12 factors:

| # | Factor | Core Idea |
|---|--------|-----------|
| 1 | Natural Language to Tool Calls | Convert user intent to structured tool invocations |
| 2 | Own Your Prompts | Version and control every prompt; no opaque framework defaults |
| 3 | Own Your Context Window | Explicitly manage what goes into the model's context |
| 4 | Tools Are Just Structured Outputs | Tool calls are structured output, not magic |
| 5 | Unify Execution State and Business State | Keep agent state synced with application state |
| 6 | Launch/Pause/Resume with Simple APIs | Straightforward lifecycle management |
| 7 | Contact Humans with Tool Calls | Human-in-the-loop via the same tool-calling mechanism |
| 8 | Own Your Control Flow | Explicit control logic, not implicit framework loops |
| 9 | Compact Errors into Context Window | Represent errors efficiently in context |
| 10 | Small, Focused Agents | Specialized agents over monolithic multi-purpose ones |
| 11 | Trigger from Anywhere | Meet users where they are |
| 12 | Make Your Agent a Stateless Reducer | Agent as pure function: input state to output state |

### Advanced Context Engineering for Coding Agents (ACE-FCA)

[github.com/humanlayer/advanced-context-engineering-for-coding-agents](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md)

- Three-phase workflow: **Research, Plan, Implement**
- **Frequent Intentional Compaction**: keep context utilization at 40–60%
- Human review is highest leverage at the research and plan stages (inverted pyramid)
- Use subagents for search/summarize tasks to keep the parent context clean
- Demonstrated on 300k LOC Rust projects; shipped 35k LOC features in 7 hours

### Blog Posts & Writing

- **"Writing a Good CLAUDE.md"** (HumanLayer blog) — keep it under 60 lines, structure around WHY/WHAT/HOW, use progressive disclosure (pointers not copies), manually craft rather than auto-generate
- **"Towards an AI-Native Auth Framework"** (Substack) — argues current auth is fundamentally inadequate for AI agents; proposes short-lived, action-specific tokens with cryptographic signatures
- **"OpenAI's Realtime API is a step towards outer-loop Agents"** (Substack)

### Talks & Podcasts

- **"12-Factor Agents"** at AI Engineer / Agents in Production 2025 (MLOps Community)
- **"Advanced Context Engineering for Agents"** at YC (August 2025)
- **Maven course:** [Advanced Context Engineering](https://maven.com/p/6cbf01/advanced-context-engineering)
- **Dev Interrupted podcast** (Feb 2026): deep dive on RPI methodology and "Ralph loops"
- **Tool Use podcast** (April 2025): "Why AI Agents Keep Failing at Simple Tasks"
- **BAML Podcast**: weekly co-host, live-coding sessions on taking AI apps from demo to production

## Dex's Core Philosophy

**"You cannot outsource the thinking."** Humans must stay in the driver's seat for architecture decisions, design choices, and strategic direction. Agents handle volume; humans handle judgment.

**"Most successful AI systems aren't following the 'here's your prompt, here's a bag of tools' pattern; instead they're mostly well-engineered software with LLM capabilities integrated at key points."** — viral X post summarizing his view after working with many agent founders.

Key principles:

1. **Engineering discipline over framework magic.** The best agents are well-engineered software with LLMs at key points, not autonomous beings given a prompt and a bag of tools.
2. **Context engineering is the core skill.** The limiting factor is not model capability but what information you put in the context window. Incorrect information is worse than missing information, which is worse than noise.
3. **Spec-first, not vibe-first.** Research the problem space, produce a plan with explicit steps, review the plan with a human, then implement.
4. **Human oversight at high-leverage points.** Not rubber-stamp code review, but meaningful review of research findings and plans *before* code is written.
5. **Human-in-the-loop as a first-class tool.** Contacting a human for approval should use the same mechanism as any other tool call — not a special case bolted on later.
6. **Ruthless context management.** Compact aggressively. Reset context frequently. Keep utilization in the 40–60% range.

## How This Maps to Our Assessment

The assessment says it "evaluates design thinking and architecture, not feature completeness." Given Dex's published views, here is what they are likely looking for:

### What We Already Do Well

| Our Feature | Maps To |
|-------------|---------|
| ADR-driven design with clear rationale | 12FA #2 (Own Your Prompts), #8 (Own Your Control Flow) — deliberate architecture |
| Three-way tool safety classification (execute/approve/ask_human) | 12FA #7 (Contact Humans with Tool Calls) — human-in-the-loop as first-class |
| Context management tool (drop/summarize/restore) | 12FA #3 (Own Your Context Window), ACE-FCA compaction |
| Server as stateless broker, all state in Postgres | 12FA #12 (Stateless Reducer), #5 (Unify State) |
| Turn-based agent lifecycle (launch/pause/resume) | 12FA #6 (Launch/Pause/Resume with Simple APIs) |
| Agent connects outbound, no exposed ports | Clean security boundary |
| Flat message model for tool calls | Simplicity over abstraction |

### Gaps and Opportunities for Next Steps

| Gap | Relevant Principle | Potential Work |
|-----|--------------------|----------------|
| No spec-first workflow (research → plan → implement) | ACE-FCA three-phase workflow | Add planning/research tools or a multi-step workflow mode |
| No subagent support | ACE-FCA subagent pattern, 12FA #10 (Small Focused Agents) | Allow spawning focused sub-tasks to keep parent context clean |
| No context compaction strategy | ACE-FCA 40–60% utilization target | Auto-compaction triggers, smarter summarization |
| Limited tool set (5 tools) | 12FA #1 (NL to Tool Calls) | Add search/grep tools, directory listing, etc. |
| No agent-initiated human contact beyond ask_human | 12FA #7 depth | Richer human interaction (clarification, confirmation, progress updates) |
| No error compaction | 12FA #9 (Compact Errors) | Summarize repeated errors instead of filling context |
| No multi-agent orchestration | 12FA #10, CodeLayer's direction | Support multiple specialized agents per session |
| Auth is shared-secret only | AI-native auth blog post | More sophisticated agent auth (though may be over-engineering for MVP) |
| No demonstration video | Assessment requirement | Record a Loom demo |

### Interview Talking Points

Things that would likely resonate with Dex based on his published views:

1. **"We chose to own our control flow"** — we built the tool loop explicitly rather than relying on framework abstractions, which aligns with 12FA #8
2. **"Human-in-the-loop is architectural, not cosmetic"** — our three-way classification system is a designed seam, not a checkbox feature
3. **"Context management is a first-class concern"** — we gave the agent explicit tools to manage its own context, not just a growing buffer
4. **"We prioritized design thinking over feature count"** — 26 ADRs document *why* we made each decision, which is the assessment's stated evaluation criteria
5. **"The server is a stateless broker"** — all state in Postgres, which maps directly to 12FA #12 (stateless reducer)

### What Would Impress

Based on the gap analysis, the highest-impact next steps that align with HumanLayer's philosophy:

1. **Demonstrate context engineering awareness** — show that you understand *why* context management matters, not just that you built it
2. **Add a spec-first workflow** — even a simple research→plan→implement mode would directly echo ACE-FCA
3. **Record the demo video** — this is an explicit deliverable requirement
4. **Be prepared to discuss trade-offs** — Dex values "why did you choose this" over "look what I built"

## Sources

- [HumanLayer YC Profile](https://www.ycombinator.com/companies/humanlayer)
- [12-Factor Agents (GitHub)](https://github.com/humanlayer/12-factor-agents)
- [ACE-FCA (GitHub)](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md)
- [The Outer Loop (Substack)](https://theouterloop.substack.com/)
- [Writing a Good CLAUDE.md (HumanLayer blog)](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [12-Factor Agents Talk (MLOps Community)](https://home.mlops.community/public/videos/12-factor-agents-patterns-of-reliable-llm-applications-dexter-horthy-agents-in-production-2025-2025-08-06)
- [YC Talk on Context Engineering](https://x.com/ycombinator/status/1960033085078356148)
- [Dev Interrupted Podcast](https://linearb.io/dev-interrupted/podcast/dex-horthy-humanlayer-rpi-methodology-ralph-loop)
- [Tool Use Podcast](https://podcasts.apple.com/nz/podcast/why-ai-agents-keep-failing-at-simple-tasks-ft-dexter-horthy/id1773693853?i=1000702714922)
- [HumanLayer.dev](https://www.humanlayer.dev/)
- [Dex on X](https://x.com/dexhorthy)
