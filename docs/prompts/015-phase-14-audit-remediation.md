# Phase 14: Audit Remediation

Fixes identified during a full code review of the project. Focus is demo polish and portfolio quality — not production hardening. Each item gets its own commit. Items requiring architectural decisions get ADRs.

## Context

A comprehensive code review identified issues across concurrency, safety, validation, performance, and UI robustness. This phase addresses the highest-impact items while staying true to the project's principle of simplicity over feature completeness. Authentication is explicitly out of scope per ADR-006 (single-user localhost deployment).

## Items

### 1. Fix session dispatch race condition (ADR-026)

**Problem:** `dispatchPendingSessions()` has a time-of-check/time-of-use race. Two concurrent calls can both find the same idle agent and assign it two sessions, losing one.

**Fix:** Use an atomic claim pattern — `SELECT ... FOR UPDATE SKIP LOCKED` on the pending session, combined with in-memory agent reservation before the DB round-trip.

**Files:** `packages/server/src/ws/dispatch.ts`, `packages/server/src/ws/agents.ts`

**Verification:** Write a test that creates two sessions and triggers two concurrent dispatches with one agent. Only one session should be assigned.

---

### 2. Add path validation on file tools (ADR-027)

**Problem:** `read_file` and `write_file` tools accept arbitrary paths. An LLM could request `../../etc/passwd` or write outside `/workspace`.

**Fix:** Resolve the requested path against the workspace root and reject any path that escapes it. This complements ADR-024 (container sandboxing) with defense-in-depth at the application layer.

**Files:** `packages/agent/src/tools/read-file.ts`, `packages/agent/src/tools/write-file.ts` (or shared validation utility)

**Verification:** Test that `../` traversal is rejected. Test that absolute paths outside workspace are rejected. Test that valid workspace paths still work.

---

### 3. Validate environment variables at startup

**Problem:** Missing `LLM_API_KEY` or `AGENT_SECRET` fails at runtime (first LLM call or first agent connection), not at startup. Hard to diagnose.

**Fix:** Validate required env vars on process start. Log clear error messages and exit non-zero if critical vars are missing. Warn (but don't exit) for vars with weak defaults.

**Files:** `packages/agent/src/index.ts`, `packages/server/src/index.ts`

**Verification:** Start agent without `LLM_API_KEY` — should exit with clear error. Start server without `AGENT_SECRET` — should warn about default value.

---

### 4. Add database indexes

**Problem:** Queries on `messages.session_id`, `messages.tool_call_id`, and `summary_messages` columns do full table scans.

**Fix:** Add indexes in the schema initialization:
```sql
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_tool_call_id ON messages(tool_call_id);
CREATE INDEX IF NOT EXISTS idx_summary_messages_summary_id ON summary_messages(summary_id);
CREATE INDEX IF NOT EXISTS idx_summary_messages_message_id ON summary_messages(message_id);
```

**Files:** `packages/server/src/db/schema.ts` (or wherever schema initialization lives)

**Verification:** `pnpm test` still passes. Indexes visible in `\d messages` output.

---

### 5. Add UI error boundary

**Problem:** A render error in any component (e.g., unexpected message shape) crashes the entire UI with a white screen.

**Fix:** Add a React error boundary wrapping the main content area. Display a fallback UI with the error message and a retry button.

**Files:** `packages/ui/src/components/ErrorBoundary.tsx` (new), `packages/ui/src/App.tsx`

**Verification:** Temporarily throw in a component — error boundary catches it and shows fallback instead of white screen.

---

### 6. Surface API errors to users

**Problem:** All API errors are caught with `console.error` and silently swallowed. Users get no feedback when operations fail.

**Fix:** Add a simple notification/toast system. API functions throw on failure; callers display the error in the UI. Keep it minimal — a dismissible banner, not a toast library.

**Files:** `packages/ui/src/api.ts`, `packages/ui/src/hooks/useSessions.ts`, `packages/ui/src/App.tsx`

**Verification:** Simulate a failed API call (e.g., stop server) — user sees error message in UI instead of silent failure.

---

### 7. Add approval timeout with auto-reject (ADR-028)

**Problem:** `waitForApproval()` returns a promise that never resolves if the user doesn't respond. The agent hangs indefinitely, and the resolver map leaks memory.

**Fix:** Add a configurable timeout (default: 5 minutes). On timeout, auto-reject the tool call and continue the agent loop. Clean up resolvers on session stop.

**Files:** `packages/agent/src/connection.ts`

**Verification:** Test that a pending approval auto-rejects after timeout. Test that session stop cleans up pending approvals.

---

## ADRs to Create

- **ADR-026:** Session Dispatch Concurrency (atomic claim pattern)
- **ADR-027:** Tool Path Validation (defense-in-depth sandbox boundary)
- **ADR-028:** Approval Timeout Policy (auto-reject after timeout)

## Verification

1. `pnpm test` — all existing tests still pass, new tests for items 1, 2, 7
2. `pnpm build` — clean build
3. `docker compose up --build` — end-to-end works
4. README updated if any user-facing behavior changed

## On Completion

Update `docs/progress.md`. Use `/conversation-notes` to generate conversation record and ADRs. Commit with message: "Phase 14 — audit remediation"
