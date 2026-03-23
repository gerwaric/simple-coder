# Feature Ideas

## Summary Toggle Side Panel

**Priority:** Post-demo
**Discussed:** Conversation 010

Currently, restoring a summary deletes the summary record and sets all source messages back to `active`. There's no way to "re-collapse" into the summarized view without creating a new summary from scratch.

**Proposed design:** A side panel (similar to the existing file panel) that lists all summaries for the current session. Each summary has a toggle to enable/disable it independently. Enabling a summary sets its messages to `summarized` and shows the summary inline; disabling restores the messages to `active` and hides the summary.

**Key considerations:**

- **Data model change:** Restore must stop deleting the summary record. Add an `enabled` field (or status) to the `summaries` table. The `summary_messages` join table entries persist regardless of toggle state.
- **Overlap validation:** The `summary_messages.message_id` unique constraint prevents a message from belonging to two summaries. But with persistent summaries, two summaries could cover overlapping message ranges. The UI (or API) must block enabling a summary if any of its messages belong to another currently-enabled summary.
- **Scope:** Touches DB schema, REST API (new toggle endpoint, changed restore semantics), context status query logic, and a new UI panel. Moderate effort across all three packages.
- **Agent-created vs user-created:** Both types would appear in the panel. The `created_by` field already distinguishes them.

**Why deferred:** The current create/restore flow is sufficient to demonstrate context management in the demo. This is a UX refinement for longer sessions.
