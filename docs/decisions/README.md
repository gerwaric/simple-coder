# Architecture Decision Records

| # | Decision | Status | Date | Source |
|---|----------|--------|------|--------|
| 001 | [Architecture Overview](001-architecture-overview.md) | Accepted | 2026-03-18 | [Conv 001](../conversations/001-initial-planning.md) |
| 002 | [Zero Tools Baseline](002-zero-tools-baseline.md) | Accepted | 2026-03-18 | [Conv 001](../conversations/001-initial-planning.md) |
| 003 | [Thinking Tokens in Protocol](003-thinking-tokens.md) | Accepted | 2026-03-18 | [Conv 001](../conversations/001-initial-planning.md) |
| 004 | [Protocol Extensibility](004-protocol-extensibility.md) | Accepted | 2026-03-18 | [Conv 001](../conversations/001-initial-planning.md) |
| 005 | [Sub-Agent Design](005-sub-agent-design.md) | Accepted | 2026-03-18 | [Conv 001](../conversations/001-initial-planning.md) |
| 006 | [Agent Authentication](006-agent-authentication.md) | Accepted | 2026-03-18 | [Conv 001](../conversations/001-initial-planning.md) |
| 007 | [Documentation Workflow](007-documentation-workflow.md) | Accepted | 2026-03-18 | [Conv 001](../conversations/001-initial-planning.md) |
| 008 | [CLAUDE.md Principles](008-claude-md-principles.md) | Accepted | 2026-03-18 | [Conv 001](../conversations/001-initial-planning.md) |
| 009 | [Progress Tracking and Implementation Prompts](009-progress-tracking.md) | Accepted | 2026-03-18 | [Conv 001](../conversations/001-initial-planning.md) |
| 010 | [Agent Tool Architecture](010-agent-tool-architecture.md) | Accepted | 2026-03-19 | [Conv 002](../conversations/002-coding-agent-design.md) |
| 011 | [Code Workspace Model](011-code-workspace-model.md) | Accepted | 2026-03-19 | [Conv 002](../conversations/002-coding-agent-design.md) |
| 012 | [Context Management Model](012-context-management-model.md) | Accepted | 2026-03-19 | [Conv 002](../conversations/002-coding-agent-design.md) |
| 013 | [Flat Message Model for Tool Calls](013-flat-message-model.md) | Accepted | 2026-03-19 | [Conv 002](../conversations/002-coding-agent-design.md) |
| 014 | [Own Agent Loop](014-own-agent-loop.md) | Accepted | 2026-03-19 | [Conv 002](../conversations/002-coding-agent-design.md) |
| 015 | [Approval Flow Design](015-approval-flow-design.md) | Accepted | 2026-03-19 | [Conv 002](../conversations/002-coding-agent-design.md) |
| 016 | [WebSocket Protocol Extension](016-websocket-protocol-extension.md) | Accepted | 2026-03-19 | [Conv 002](../conversations/002-coding-agent-design.md) |
| 017 | [Dynamic System Prompt](017-dynamic-system-prompt.md) | Accepted | 2026-03-19 | [Conv 002](../conversations/002-coding-agent-design.md) |
| 018 | [Sub-Phase Implementation Tracks](018-sub-phase-tracks.md) | Accepted | 2026-03-20 | [Conv 003](../conversations/003-coding-agent-implementation.md) |
| 019 | [Turn-Complete Idle Signaling](019-turn-complete-idle-signaling.md) | Accepted | 2026-03-20 | [Conv 004](../conversations/004-debugging-ui-and-agent-lifecycle.md) |
| 020 | [Bug Documentation Strategy](020-bug-documentation-strategy.md) | Accepted | 2026-03-20 | [Conv 004](../conversations/004-debugging-ui-and-agent-lifecycle.md) |
| 021 | [Context Bar UI for Message Management](021-context-bar-ui.md) | Accepted | 2026-03-20 | [Conv 005](../conversations/005-phase-13-testing-and-ui-polish.md) |
| 022 | [Tool Call Pairing in UI](022-tool-call-pairing.md) | Accepted | 2026-03-20 | [Conv 005](../conversations/005-phase-13-testing-and-ui-polish.md) |
| 023 | [Session Lifecycle Operations from Sidebar](023-session-lifecycle-sidebar.md) | Accepted | 2026-03-20 | [Conv 005](../conversations/005-phase-13-testing-and-ui-polish.md) |
| 024 | [Agent Container Sandboxing](024-agent-container-sandboxing.md) | Accepted | 2026-03-20 | [Conv 005](../conversations/005-phase-13-testing-and-ui-polish.md) |
| 025 | [Real Database IDs for Tool Messages](025-real-ids-for-tool-messages.md) | Accepted | 2026-03-20 | [Conv 005](../conversations/005-phase-13-testing-and-ui-polish.md) |
| 026 | [Audit Remediation as Single Phase](026-audit-remediation-phase.md) | Accepted | 2026-03-21 | [Conv 006](../conversations/006-code-audit-and-remediation-planning.md) |
| 027 | [Session Dispatch Concurrency](027-dispatch-concurrency.md) | Accepted | 2026-03-21 | [Conv 006](../conversations/006-code-audit-and-remediation-planning.md) |
| 028 | [Tool Path Validation](028-tool-path-validation.md) | Accepted | 2026-03-21 | [Conv 006](../conversations/006-code-audit-and-remediation-planning.md) |
| 029 | [Approval Timeout Policy](029-approval-timeout.md) | Accepted | 2026-03-21 | [Conv 006](../conversations/006-code-audit-and-remediation-planning.md) |
| 030 | [User-Initiated Summarization](030-user-initiated-summarization.md) | Accepted | 2026-03-22 | [Conv 007](../conversations/007-humanlayer-research-and-context-features.md) |
| 031 | [CLAUDE.md Prepend to Context](031-claude-md-prepend.md) | Accepted | 2026-03-22 | [Conv 007](../conversations/007-humanlayer-research-and-context-features.md) |
| 032 | [Workspace Filesystem Viewer](032-workspace-filesystem-viewer.md) | Accepted | 2026-03-22 | [Conv 008](../conversations/008-filesystem-viewer-and-token-budget.md) |
| 033 | [Configurable Token Budget](033-configurable-token-budget.md) | Accepted | 2026-03-22 | [Conv 008](../conversations/008-filesystem-viewer-and-token-budget.md) |
| 034 | [Transient Agent Warnings](034-transient-agent-warnings.md) | Accepted | 2026-03-22 | [Conv 009](../conversations/009-bug-fixes-and-rate-limit-handling.md) |
| 035 | [Context Status Broadcast on Agent Messages](035-context-status-broadcast-on-agent-messages.md) | Accepted | 2026-03-22 | [Conv 009](../conversations/009-bug-fixes-and-rate-limit-handling.md) |
| 036 | [Positional Repair of Orphaned Tool Pairs](036-positional-tool-pair-repair.md) | Accepted | 2026-03-22 | [Conv 010](../conversations/010-orphan-tool-fix-and-demo-planning.md) |
