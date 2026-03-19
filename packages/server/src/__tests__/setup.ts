import postgres from "postgres";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { createApp } from "../app.js";
import { initDb } from "../db/init.js";
import { resetConnections } from "../ws/connections.js";
import WebSocket from "ws";
import type { ServerToUI } from "@simple-coder/shared";

// Use test-specific env
const TEST_DB = "simple_coder_test";

export const sql = postgres({
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER || "simple_coder",
  password: process.env.POSTGRES_PASSWORD || "simple_coder",
  database: TEST_DB,
});

export interface TestServer {
  port: number;
  baseUrl: string;
  server: ServerType;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  resetConnections();
  await initDb(sql);
  await sql`DELETE FROM messages`;
  await sql`DELETE FROM sessions`;

  const { app, injectWebSocket } = createApp(sql);

  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, port: 0 }, () => {
      const port = (server.address() as { port: number }).port;
      injectWebSocket(server);
      resolve({
        port,
        baseUrl: `http://localhost:${port}`,
        server,
        close: () =>
          new Promise<void>((res) => {
            resetConnections();
            server.close(() => res());
          }),
      });
    });
  });
}

type AnyMessage = { type: string; [key: string]: unknown };

function createMessageCollector<T extends AnyMessage>(ws: WebSocket) {
  const messages: T[] = [];
  const listeners: Array<{ predicate: (msg: T) => boolean; resolve: (msg: T) => void }> = [];

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString()) as T;
    messages.push(msg);
    const idx = listeners.findIndex((l) => l.predicate(msg));
    if (idx >= 0) {
      const [listener] = listeners.splice(idx, 1);
      listener.resolve(msg);
    }
  });

  function waitFor(type: string, timeout?: number): Promise<T>;
  function waitFor(predicate: (msg: T) => boolean, timeout?: number): Promise<T>;
  function waitFor(typeOrPredicate: string | ((msg: T) => boolean), timeout = 5000): Promise<T> {
    const predicate =
      typeof typeOrPredicate === "string"
        ? (msg: T) => msg.type === typeOrPredicate
        : typeOrPredicate;

    return new Promise((res, rej) => {
      const idx = messages.findIndex(predicate);
      if (idx >= 0) {
        const [msg] = messages.splice(idx, 1);
        return res(msg);
      }
      const timer = setTimeout(() => rej(new Error(`Timeout waiting for message`)), timeout);
      listeners.push({
        predicate,
        resolve: (msg) => {
          clearTimeout(timer);
          res(msg);
        },
      });
    });
  }

  return { messages, waitFor };
}

export function connectAgent(port: number, agentId: string, secret = "change-me") {
  return new Promise<{
    ws: WebSocket;
    messages: AnyMessage[];
    waitFor: {
      (type: string, timeout?: number): Promise<AnyMessage>;
      (predicate: (msg: AnyMessage) => boolean, timeout?: number): Promise<AnyMessage>;
    };
  }>((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws/agent`);
    const { messages, waitFor } = createMessageCollector<AnyMessage>(ws);

    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "agent:register", agentId, secret }));
      resolve({ ws, messages, waitFor });
    });

    ws.on("error", reject);
  });
}

export function connectUi(port: number) {
  return new Promise<{
    ws: WebSocket;
    messages: ServerToUI[];
    waitFor: {
      (type: string, timeout?: number): Promise<ServerToUI>;
      (predicate: (msg: ServerToUI) => boolean, timeout?: number): Promise<ServerToUI>;
    };
  }>((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws/ui`);
    const { messages, waitFor } = createMessageCollector<ServerToUI>(ws);

    ws.on("open", () => resolve({ ws, messages, waitFor }));
    ws.on("error", reject);
  });
}

export async function cleanupDb(): Promise<void> {
  await sql`DELETE FROM messages`;
  await sql`DELETE FROM sessions`;
}

export async function closeDb(): Promise<void> {
  await sql.end();
}
