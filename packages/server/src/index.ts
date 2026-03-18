import { Hono } from "hono";
import { serve } from "@hono/node-server";

const app = new Hono();

app.get("/", (c) => c.text("simple-coder server"));

const port = Number(process.env.SERVER_PORT) || 3000;
serve({ fetch: app.fetch, port }, () => {
  console.log(`simple-coder server listening on port ${port}`);
});
