import { config } from "dotenv";
config({ path: new URL("../../../.env", import.meta.url).pathname });
import { serve } from "@hono/node-server";
import { sql } from "./db/index.js";
import { initDb } from "./db/init.js";
import { createApp } from "./app.js";

// Validate environment
if (!process.env.AGENT_SECRET) {
  console.warn("WARNING: AGENT_SECRET not set, using default — set this in production");
}

const { app, injectWebSocket } = createApp(sql);

const port = Number(process.env.SERVER_PORT) || 3000;

initDb(sql).then(() => {
  const server = serve({ fetch: app.fetch, port }, () => {
    console.log(`simple-coder server listening on port ${port}`);
  });
  injectWebSocket(server);
});
