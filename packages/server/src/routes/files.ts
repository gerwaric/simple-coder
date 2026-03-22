import { Hono } from "hono";
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, relative, join } from "node:path";

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

function getWorkspaceDir(): string {
  if (process.env.WORKSPACE_DIR) return resolve(process.env.WORKSPACE_DIR);
  // In Docker, /workspace exists. For local dev, fall back to project-root .workspace/
  if (existsSync("/workspace")) return "/workspace";
  return resolve(process.cwd(), "../../.workspace");
}

function validatePath(requestedPath: string): string {
  const workspace = resolve(getWorkspaceDir());
  const resolved = resolve(workspace, requestedPath);
  const rel = relative(workspace, resolved);
  if (rel.startsWith("..") || resolve(workspace, rel) !== resolved) {
    throw new Error("Path escapes workspace");
  }
  return resolved;
}

export function fileRoutes(): Hono {
  const app = new Hono();

  // List directory contents
  app.get("/", async (c) => {
    const requestedPath = c.req.query("path") || "";

    let resolved: string;
    try {
      resolved = validatePath(requestedPath);
    } catch {
      return c.json({ error: "Invalid path" }, 400);
    }

    try {
      const entries = await readdir(resolved, { withFileTypes: true });
      const items = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = join(resolved, entry.name);
          try {
            const s = await stat(fullPath);
            return {
              name: entry.name,
              type: entry.isDirectory() ? "directory" : "file",
              size: s.size,
              modifiedAt: s.mtime.toISOString(),
            };
          } catch {
            return {
              name: entry.name,
              type: entry.isDirectory() ? "directory" : "file",
              size: 0,
              modifiedAt: new Date().toISOString(),
            };
          }
        }),
      );

      // Sort: directories first, then alphabetical
      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return c.json(items);
    } catch (err: any) {
      if (err.code === "ENOENT") return c.json({ error: "Not found" }, 404);
      if (err.code === "ENOTDIR") return c.json({ error: "Not a directory" }, 400);
      return c.json({ error: "Failed to list directory" }, 500);
    }
  });

  // Read file contents
  app.get("/read", async (c) => {
    const requestedPath = c.req.query("path");
    if (!requestedPath) {
      return c.json({ error: "path query parameter is required" }, 400);
    }

    let resolved: string;
    try {
      resolved = validatePath(requestedPath);
    } catch {
      return c.json({ error: "Invalid path" }, 400);
    }

    try {
      const s = await stat(resolved);
      if (s.isDirectory()) {
        return c.json({ error: "Path is a directory" }, 400);
      }
      if (s.size > MAX_FILE_SIZE) {
        return c.json({ error: `File too large (${s.size} bytes, max ${MAX_FILE_SIZE})` }, 400);
      }

      const content = await readFile(resolved, "utf-8");
      return c.text(content);
    } catch (err: any) {
      if (err.code === "ENOENT") return c.json({ error: "Not found" }, 404);
      return c.json({ error: "Failed to read file" }, 500);
    }
  });

  return app;
}
