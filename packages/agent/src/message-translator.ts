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

  return result;
}
