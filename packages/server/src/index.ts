import { config } from "dotenv";
config({ path: new URL("../../../.env", import.meta.url).pathname });
import { serve } from "@hono/node-server";
import { sql } from "./db/index.js";
import { initDb } from "./db/init.js";
import { createApp } from "./app.js";

const { app, injectWebSocket } = createApp(sql);

const port = Number(process.env.SERVER_PORT) || 3000;

initDb(sql).then(() => {
  const server = serve({ fetch: app.fetch, port }, () => {
    console.log(`simple-coder server listening on port ${port}`);
  });
  injectWebSocket(server);
});
