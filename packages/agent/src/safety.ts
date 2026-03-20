export type ToolAction = "execute" | "approve" | "ask_human";

export function assessToolCall(
  toolName: string,
  _args: unknown,
): { action: ToolAction } {
  if (toolName === "ask_human") return { action: "ask_human" };
  const safeTools = ["read_file", "context"];
  return { action: safeTools.includes(toolName) ? "execute" : "approve" };
}
