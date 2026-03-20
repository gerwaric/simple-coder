import { tool } from "ai";
import { z } from "zod";

export const agentTools = {
  bash: tool({
    description: "Run a shell command in the workspace",
    parameters: z.object({ command: z.string() }),
  }),
  read_file: tool({
    description: "Read the contents of a file",
    parameters: z.object({ path: z.string() }),
  }),
  write_file: tool({
    description: "Write content to a file",
    parameters: z.object({ path: z.string(), content: z.string() }),
  }),
  context: tool({
    description:
      "Manage your context window. Actions: status (view token usage and message states), drop (remove messages from context), activate (restore messages to context), summarize (replace messages with a summary)",
    parameters: z.object({
      action: z.enum(["status", "drop", "activate", "summarize"]),
      messageIds: z.array(z.string()).optional(),
      summary: z.string().optional(),
    }),
  }),
  ask_human: tool({
    description:
      "Ask the user a question and wait for their response. Use when uncertain about approach, requirements, or preferences.",
    parameters: z.object({ question: z.string() }),
  }),
};
