import type { CoreMessage, ToolCallPart, ToolResultPart } from "ai";
import type { Message } from "@simple-coder/shared";

/**
 * Translate our flat message list to Vercel AI SDK format.
 *
 * Our format stores tool_call and tool_result as separate messages.
 * The SDK expects:
 * - assistant messages can contain both text and toolCall parts
 * - tool results are separate "tool" role messages
 *
 * We need to merge adjacent assistant + tool_call messages into
 * a single assistant message with both content and tool call parts.
 */
export function toSdkMessages(messages: Message[]): CoreMessage[] {
  const result: CoreMessage[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === "user") {
      result.push({ role: "user", content: msg.content });
      i++;
    } else if (msg.role === "system") {
      result.push({ role: "system", content: msg.content });
      i++;
    } else if (msg.role === "assistant") {
      // Check if followed by tool_call messages — merge them
      const parts: Array<{ type: "text"; text: string } | ToolCallPart> = [];

      if (msg.content) {
        parts.push({ type: "text", text: msg.content });
      }

      i++;

      // Collect any following tool_call messages into this assistant message
      while (i < messages.length && messages[i].role === "tool_call") {
        const tc = messages[i];
        parts.push({
          type: "tool-call",
          toolCallId: tc.toolCallId!,
          toolName: tc.toolName!,
          args: tc.toolArgs ?? {},
        });
        i++;
      }

      if (parts.length > 0) {
        result.push({ role: "assistant", content: parts });
      } else {
        result.push({ role: "assistant", content: msg.content });
      }
    } else if (msg.role === "tool_call") {
      // Tool call without preceding assistant message — create an assistant message for it
      const toolCalls: ToolCallPart[] = [];

      while (i < messages.length && messages[i].role === "tool_call") {
        const tc = messages[i];
        toolCalls.push({
          type: "tool-call",
          toolCallId: tc.toolCallId!,
          toolName: tc.toolName!,
          args: tc.toolArgs ?? {},
        });
        i++;
      }

      result.push({ role: "assistant", content: toolCalls });
    } else if (msg.role === "tool_result") {
      result.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: msg.toolCallId!,
            toolName: msg.toolName!,
            result: msg.content,
          },
        ],
      });
      i++;
    } else {
      // Skip unknown roles
      i++;
    }
  }

  // Fix orphaned tool pairs from agent crash/disconnect mid-tool-loop.
  // The Anthropic API requires:
  //   1. Every tool_use in an assistant message must have a tool_result immediately after
  //   2. Every tool_result must reference a tool_use in the immediately preceding assistant message
  // We fix both: inject synthetic results for orphan calls, drop orphan results.

  // Walk the message list and validate tool-call/tool-result pairing positionally.
  // For each group of tool messages, find the preceding assistant message and
  // check that every tool_result ID matches a tool_call in THAT assistant message.
  for (let j = result.length - 1; j >= 0; j--) {
    const msg = result[j];

    // Fix direction 1: orphan tool results (result references a call not in preceding assistant)
    if (msg.role === "tool" && Array.isArray(msg.content)) {
      // Find the preceding assistant message
      let precedingAssistant: CoreMessage | null = null;
      for (let k = j - 1; k >= 0; k--) {
        if (result[k].role === "tool") continue; // skip other tool results in same group
        if (result[k].role === "assistant") {
          precedingAssistant = result[k];
        }
        break;
      }

      const precedingCallIds = new Set<string>();
      if (precedingAssistant && Array.isArray(precedingAssistant.content)) {
        for (const part of precedingAssistant.content as Array<{ type: string; toolCallId?: string }>) {
          if (part.type === "tool-call" && part.toolCallId) {
            precedingCallIds.add(part.toolCallId);
          }
        }
      }

      const parts = msg.content as ToolResultPart[];
      const validParts = parts.filter((p) => p.toolCallId && precedingCallIds.has(p.toolCallId));
      const droppedParts = parts.filter((p) => !p.toolCallId || !precedingCallIds.has(p.toolCallId));

      if (droppedParts.length > 0) {
        console.warn(`[translator] dropping ${droppedParts.length} orphaned tool result(s)`);
      }

      if (validParts.length === 0) {
        result.splice(j, 1);
      } else if (validParts.length < parts.length) {
        msg.content = validParts;
      }
    }

    // Fix direction 2: orphan tool calls (call with no matching result after)
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      const toolCallIds = (msg.content as Array<{ type: string; toolCallId?: string }>)
        .filter((p) => p.type === "tool-call" && p.toolCallId)
        .map((p) => p.toolCallId!);

      if (toolCallIds.length === 0) continue;

      const answeredIds = new Set<string>();
      for (let k = j + 1; k < result.length; k++) {
        const r = result[k];
        if (r.role === "tool" && Array.isArray(r.content)) {
          for (const part of r.content as ToolResultPart[]) {
            if (part.toolCallId) answeredIds.add(part.toolCallId);
          }
        } else {
          break;
        }
      }

      const orphanIds = toolCallIds.filter((id) => !answeredIds.has(id));
      if (orphanIds.length === 0) continue;

      console.warn(`[translator] injecting ${orphanIds.length} synthetic result(s) for interrupted tool call(s)`);

      let insertAt = j + 1;
      while (insertAt < result.length && result[insertAt].role === "tool") {
        insertAt++;
      }

      const syntheticResults: CoreMessage[] = orphanIds.map((id) => ({
        role: "tool" as const,
        content: [
          {
            type: "tool-result" as const,
            toolCallId: id,
            toolName: "unknown",
            result: "Tool call was interrupted — no result available.",
          },
        ],
      }));

      result.splice(insertAt, 0, ...syntheticResults);
    }
  }

  return result;
}
