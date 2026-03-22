# Tool Path Validation
**Status:** Accepted
**Date:** 2026-03-21
**Source:** [Conversation 006](../conversations/006-code-audit-and-remediation-planning.md)

## Context

The `read_file` and `write_file` tools accepted arbitrary paths from the LLM. A model could request `../../etc/passwd` or write to any location on the filesystem. While ADR-024 provides container-level sandboxing (read-only root filesystem, `/workspace` volume), the application layer had no path validation — no defense-in-depth.

## Decision

Add a `validatePath()` function in the tool executor that:

1. Resolves the requested path against the workspace root (using `path.resolve`)
2. Computes the relative path back from workspace to the resolved path
3. Rejects any path where the relative path starts with `..` (escapes workspace)

Both `executeReadFile` and `executeWriteFile` call `validatePath` before any filesystem operation. Invalid paths return an error result to the LLM (not a crash), so the agent loop continues.

This is defense-in-depth alongside ADR-024's container sandboxing. The container prevents filesystem escape at the OS level; path validation prevents it at the application level. Either layer alone is sufficient, but both together mean a misconfiguration in one doesn't expose the other.

## Consequences

- LLM cannot read or write files outside the workspace directory
- Relative paths (e.g., `src/index.ts`) resolve correctly against the workspace root
- Absolute paths outside the workspace (e.g., `/etc/passwd`) are rejected
- Directory traversal (e.g., `../../etc/passwd`) is rejected
- Error messages tell the LLM the path was invalid, so it can self-correct
- `bash` tool is not path-validated — it runs in the workspace as cwd but can reach anywhere the container allows; this is intentional, as bash commands have broader legitimate needs and are already gated by approval
