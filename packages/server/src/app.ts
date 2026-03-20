import { Hono } from "hono";
import { createNodeWebSocket } from "@hono/node-ws";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Sql } from "postgres";
import { sessionRoutes } from "./routes/sessions.js";
import { toolRoutes } from "./routes/tools.js";
import { contextRoutes, createSummaryRoutes } from "./routes/context.js";
import { createAgentWsHandlers } from "./ws/agent-ws.js";
import { createUiWsHandlers } from "./ws/ui-ws.js";

export function createApp(sql: Sql) {
  const app = new Hono();
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  // REST routes
  app.route("/api/sessions", sessionRoutes(sql));
  app.route("/api/tools", toolRoutes(sql));
  app.route("/api/messages", contextRoutes(sql));
  app.route("/api/summaries", createSummaryRoutes(sql));

  // WebSocket routes
  app.get(
    "/ws/agent",
    upgradeWebSocket(() => createAgentWsHandlers(sql)),
  );

  app.get(
    "/ws/ui",
    upgradeWebSocket(() => createUiWsHandlers()),
  );

  // Static UI files (production)
  app.use("/*", serveStatic({ root: "./public" }));
  app.get("/*", serveStatic({ root: "./public", path: "index.html" }));

  return { app, injectWebSocket };
}
