# Agent Tool Architecture
**Status:** Accepted
**Date:** 2026-03-19
**Source:** [Conversation 002](../conversations/002-coding-agent-design.md)

## Context

The system has a working conversational agent with no tools. To become a coding agent, it needs tools. The project definition evaluates design thinking over feature completeness, and HumanLayer's product is about human oversight of AI agent actions. The tool architecture is itself what's being evaluated.

We considered the full spectrum: a single `bash` tool, many purpose-built tools, or a middle ground. We also considered how tools map to approval boundaries and UI rendering.

## Decision

Five tools with three execution patterns:

| Tool | Purpose | Execution | Approval |
|------|---------|-----------|----------|
| `bash` | General-purpose shell (git, exploration, commands) | Local in agent container | Yes |
| `read_file` | Structured file reading | Local in agent container | No |
| `write_file` | Structured file writing | Local in agent container | Yes |
| `context` | Context management (status, drop, summarize, activate) | HTTP to server API | No |
| `ask_human` | Ask the user a question and wait for response | WebSocket wait | Yes (blocks for response) |

`bash` gives git, test runners, and general-purpose capability for free. `read_file` and `write_file` provide structured input/output for clean UI rendering and a clear approval boundary. `context` makes context management explicit. `ask_human` encourages the agent to involve the human at decision points rather than guessing.

The observe vs mutate boundary defines the approval model: reads are safe, mutations need approval. A placeholder safety check function (`assessToolCall`) classifies tools — currently approves `read_file`, `context`, `ask_human` and requires approval for `bash` and `write_file`. This function is a seam for future classification logic.

## Consequences

- Two of five tools involve human interaction, signaling design priority around human-in-the-loop
- `bash` provides broad capability without implementing many specialized tools
- Structured file tools give the UI clean data to render (file contents, diffs) vs raw stdout
- The safety check is a placeholder that can evolve without architectural changes
- The agent container needs git and basic dev tools installed
