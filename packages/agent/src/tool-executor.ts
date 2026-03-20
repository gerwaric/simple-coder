import { exec } from "node:child_process";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname } from "node:path";

async function resolveWorkspace(): Promise<string> {
  const dir = process.env.WORKSPACE_DIR || "/workspace";
  try {
    await access(dir);
    return dir;
  } catch {
    return process.cwd();
  }
}

let workspaceDir: string | null = null;
async function getWorkspace(): Promise<string> {
  if (!workspaceDir) workspaceDir = await resolveWorkspace();
  return workspaceDir;
}

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  sessionId?: string,
): Promise<unknown> {
  switch (toolName) {
    case "bash":
      return executeBash(args.command as string);
    case "read_file":
      return executeReadFile(args.path as string);
    case "write_file":
      return executeWriteFile(args.path as string, args.content as string);
    case "context":
      return executeContext(args.action as string, sessionId!, args.messageIds as string[] | undefined, args.summary as string | undefined);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// Derive HTTP URL from WS URL (ws://host:port/ws/agent → http://host:port)
function getServerHttpUrl(): string {
  const wsUrl = process.env.SERVER_WS_URL || "ws://localhost:3000/ws/agent";
  return wsUrl.replace(/^ws/, "http").replace(/\/ws\/agent$/, "");
}

async function executeBash(
  command: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const cwd = await getWorkspace();
  return new Promise((resolve) => {
    exec(command, { cwd, timeout: 60000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({
        stdout: stdout || "",
        stderr: stderr || "",
        exitCode: typeof err?.code === "number" ? err.code : err ? 1 : 0,
      });
    });
  });
}

async function executeReadFile(
  path: string,
): Promise<{ content: string } | { error: string }> {
  try {
    const content = await readFile(path, "utf-8");
    return { content };
  } catch (err: any) {
    return { error: err.message };
  }
}

async function executeWriteFile(
  path: string,
  content: string,
): Promise<{ success: boolean } | { error: string }> {
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf-8");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

async function executeContext(
  action: string,
  sessionId: string,
  messageIds?: string[],
  summary?: string,
): Promise<unknown> {
  const baseUrl = getServerHttpUrl();

  try {
    switch (action) {
      case "status": {
        const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/context`);
        return await res.json();
      }
      case "drop": {
        if (!messageIds?.length) return { error: "messageIds required for drop action" };
        for (const id of messageIds) {
          await fetch(`${baseUrl}/api/messages/${id}/context-status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "inactive" }),
          });
        }
        return { success: true, dropped: messageIds.length };
      }
      case "activate": {
        if (!messageIds?.length) return { error: "messageIds required for activate action" };
        for (const id of messageIds) {
          await fetch(`${baseUrl}/api/messages/${id}/context-status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "active" }),
          });
        }
        return { success: true, activated: messageIds.length };
      }
      case "summarize": {
        if (!messageIds?.length) return { error: "messageIds required for summarize action" };
        if (!summary) return { error: "summary text required for summarize action" };
        const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/summaries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: summary, messageIds, createdBy: "agent" }),
        });
        if (!res.ok) {
          const body = await res.json();
          return { error: body.error || "Failed to create summary" };
        }
        return await res.json();
      }
      default:
        return { error: `Unknown context action: ${action}` };
    }
  } catch (err: any) {
    return { error: err.message };
  }
}
