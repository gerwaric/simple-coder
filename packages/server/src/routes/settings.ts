import { Hono } from "hono";
import { getTokenBudget, setTokenBudget } from "../settings.js";

export function settingsRoutes(): Hono {
  const app = new Hono();

  app.get("/token-budget", (c) => {
    return c.json({ tokenBudget: getTokenBudget() });
  });

  app.put("/token-budget", async (c) => {
    const body = await c.req.json<{ tokenBudget: number }>();
    if (typeof body.tokenBudget !== "number" || body.tokenBudget < 1000) {
      return c.json({ error: "tokenBudget must be a number >= 1000" }, 400);
    }
    setTokenBudget(body.tokenBudget);
    return c.json({ tokenBudget: getTokenBudget() });
  });

  return app;
}
