# Orphan Tool Fix and Demo Planning
**Date:** 2026-03-22

## Decisions Made
- [ADR-036: Positional Repair of Orphaned Tool Pairs](../decisions/036-positional-tool-pair-repair.md)

## Discussion

### The Orphaned Tool Call Bug

**Tom:** The project is @README.md. The known issues are @docs/known-issues.md. The specific one I'm seeing is this agent console message: `messages.7: tool_use ids were found without tool_result blocks immediately after: 18ba019b-6f31-4e18-ba64-5994127c37cc`. This happens after I sent the message "Context is getting full - can you summarize our conversation so far to free up space?"

**Claude:** This is the orphaned tool calls issue from known-issues.md. The `toSdkMessages` translator in `packages/agent/src/message-translator.ts` needs to detect unpaired tool calls and inject synthetic results. I added a cleanup pass that scans assistant messages for tool-call parts without matching tool-result messages, and injects synthetic "Tool call was interrupted" results.

**Tom:** I'm still seeing a similar but not identical error: `messages.10.content.0: unexpected tool_use_id found in tool_result blocks: 18ba019b-6f31-4e18-ba64-5994127c37cc. Each tool_result block must have a corresponding tool_use block in the previous message.`

**Claude:** Same tool ID but now the opposite problem: there's a `tool_result` referencing a `tool_use` that doesn't exist. The fix needs to handle both directions. I updated the code to also drop tool_result messages that reference non-existent tool calls, collecting all tool-call IDs from assistant messages first, then filtering out orphaned results.

**Tom:** The translator isn't catching it. No debug log output, same error.

**Claude:** The fix isn't firing because the tool_call ID does exist in an assistant message — just not in the immediately preceding one. The API requires each `tool_result` to match a `tool_use` in the **previous message** specifically, not just anywhere in the history. My global ID collection approach was wrong. I need positional validation: for each tool-result message, find the immediately preceding assistant message and check that the result IDs match call IDs in THAT specific message. I added a full debug dump of the SDK message structure plus positional validation.

**Tom:** That fix worked. All the blocked messages were queued up and executed in a row, which the LLM was amused by. Then it summarized the conversation.

**Claude:** The key insight was that the Anthropic API enforces strict positional pairing, not global. Three iterations to get right: first handled only missing results at the end, second used global ID matching (wrong), third did positional validation against the immediately preceding assistant message.

### Summary Toggle Side Panel (Deferred)

**Tom:** Now I have a question about the summarization UI. If I click "restore" to see the original messages, is there any way to get back to the summarized view in our current design?

**Claude:** No — not directly. Restore deletes the summary record and sets all the original messages back to `active`. There's no "toggle back to summarized" button. To get back to a summarized view, you'd need to manually re-summarize: select the messages again and write a new summary. The design is non-destructive (original messages are never lost), but the summary itself is gone after restore.

**Tom:** Let's think about what it would take to implement. I'm thinking we could have a "summaries" sidepanel with a view toggle like the "files" panel, and we could use that panel to enable to disable summaries individually, regardless of their source. However, there will have to be logic to check for overlap so that if the user has one summary "enabled" and tries to enable another summary from earlier in the session that partially overlaps, the UI blocks that action. Let's work back and forth to think about this issue, and if it's something we should tackle.

**Claude:** For the feature you're describing — a summaries side panel with enable/disable toggles — here's what I see as the key changes:

**Data model:** Restore would need to stop deleting the summary. Instead, summaries would get an `enabled` boolean. Disabling a summary restores its messages to `active`; enabling sets them back to `summarized`. The summary record persists either way.

**Overlap logic:** The unique constraint on `summary_messages.message_id` prevents overlapping summaries today because creating one deletes the other. With persistent summaries, we'd need client-side (or server-side) validation: before enabling a summary, check if any of its messages belong to another currently-enabled summary.

**UI:** A side panel listing all summaries for the session, each with a toggle. Could show metadata like message count, creation source (agent/user), and which messages it covers.

**Scope concern:** This touches the DB schema, the REST API, the context query logic, and a new UI panel. It's a meaningful chunk of work across all three packages.

For the demo, the current behavior (summarize/restore) already demonstrates context management. The toggle feature is a UX refinement that shows well in a longer session but isn't needed to demonstrate the core capability.

**Tom:** Let's take notes about this feature idea, but design the demo without it.

**Claude:** Created `docs/feature-ideas.md` with the summary toggle panel concept captured.

### Demo Planning

**Tom:** I just thought of simple way to show user management of context. I asked the agent to add 3 and 7 without showing its work, then I removed my question from the context window, then I asked it where the 10 came from and it didn't know. Then I re-enabled my chat and it figured it out. This is a really really simple example, however.

**Claude:** That's a great demo sequence — it's intuitive and shows the "why" of context management in about 30 seconds. The viewer immediately understands: remove context, the agent loses knowledge; restore it, it recovers. The simplicity is actually a strength for a demo.

**Tom:** I like the summarization demo, so I'm thinking I'll do the automatic summarization from the crypto library analysis, then show how the user can manage message context themselves, too.

**Claude:** That's a solid two-part demo — the crypto analysis shows the agent managing its own context under real pressure, and the simple math example shows the user side. Together they cover both halves of the context management story.

**Tom:** I also just got the LLM to remove all tool calls from its own context window. This is what it said: "I can see from the context status that there are many message pairs with 0 token counts, which are likely tool results. However, I notice that removing tool call/result pairs might break the context flow since they're essential for understanding what actions I took and their outcomes. Instead, let me drop the messages with 0 token counts (which are primarily empty tool results) to free up space."

So now I'm thinking:
0. Start in media res with the crypto library loaded and explained
1. Ask the LLM to automatically summarize
2. Show the 3+7 trick
3. Restore the crypto messages and remove the summary
4. Ask the agent to hide tool calls

**Claude:** That's a really clean narrative arc. Each step builds on the last. Step 4 is the strongest ending — it demonstrates that the agent understands the semantic value of different message types and makes smart choices about what to keep vs. drop.

One concern: step 3 (restore crypto messages, remove summary) might feel like housekeeping mid-demo. Would it flow better to do the 3+7 trick before the crypto summarization?

**Tom:** The issue is that I have to restore the crypto messages to expose the tool calls in order for the agent to hide them.

**Claude:** Right — the tool calls are inside the summarized content, so you need to restore to get them back as individual messages before the agent can selectively drop them. Step 3 isn't really housekeeping — it's setup that the audience sees as "look, I can undo the summary," which is itself a demo point. Created `docs/demo-plan.md` with the full flow.
