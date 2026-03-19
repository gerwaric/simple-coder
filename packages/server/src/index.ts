import { config } from "dotenv";
config({ path: new URL("../../../.env", import.meta.url).pathname });
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createNodeWebSocket } from "@hono/node-ws";
import { sql } from "./db/index.js";
import { initDb } from "./db/init.js";
import { sessionRoutes } from "./routes/sessions.js";
import { createAgentWsHandlers } from "./ws/agent-ws.js";
import { createUiWsHandlers } from "./ws/ui-ws.js";

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// REST routes
app.route("/api/sessions", sessionRoutes(sql));

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

const port = Number(process.env.SERVER_PORT) || 3000;

initDb(sql).then(() => {
  const server = serve({ fetch: app.fetch, port }, () => {
    console.log(`simple-coder server listening on port ${port}`);
  });
  injectWebSocket(server);
});
