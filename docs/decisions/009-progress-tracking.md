# Progress Tracking and Implementation Prompts
**Status:** Accepted
**Date:** 2026-03-18
**Source:** [Conversation 001](../conversations/001-initial-planning.md)

## Context

The implementation plan has 8 phases. Work may span multiple Claude Code sessions, and each session starts with zero context. We need a way to track what's done and what's next, and a way to give a new session enough context to pick up where the last one left off. A single prompt for the entire implementation was considered but rejected due to context window pressure, verification gaps, and git history concerns.

## Decision

Two mechanisms working together:

1. **Per-phase prompts** (`docs/prompts/NNN-phase-N-*.md`) — one self-contained prompt per implementation phase. Each prompt references the plan and progress file, lists specific files to create, verification steps, and commit instructions. A new session reads the progress file, finds the next incomplete phase, and executes its prompt.

2. **Progress file** (`docs/progress.md`) — tracks the status of every phase (not started / in progress / completed) with commit hashes. Updated and committed after each phase completion. Serves as the handoff point between sessions.

A single implementation prompt was rejected because:
- ~40 files across 8 phases would degrade quality as context fills
- Per-phase verification gates would be skipped
- Debugging failures in a massive run is harder
- Git history would collapse into one or two giant commits

## Consequences

- Any new session can resume from where the last left off by reading docs/progress.md
- Per-phase prompts enforce verification gates and clean commits
- The prompts directory also serves as documentation of methodology (assessment requirement)
- Slightly more overhead per phase (read progress, find prompt, execute) but safer and more traceable
