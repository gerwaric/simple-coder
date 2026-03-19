import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startTestServer, cleanupDb, closeDb, type TestServer } from "./setup.js";

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
  await closeDb();
});

beforeEach(async () => {
  await cleanupDb();
});

describe("POST /api/sessions", () => {
  it("creates a session with state=pending", async () => {
    const res = await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.session.state).toBe("pending");
    expect(body.message.role).toBe("user");
    expect(body.message.content).toBe("hello");
  });

  it("returns 400 if message is missing", async () => {
    const res = await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/sessions", () => {
  it("lists all sessions", async () => {
    // Create two sessions
    await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "first" }),
    });
    await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "second" }),
    });

    const res = await fetch(`${server.baseUrl}/api/sessions`);
    expect(res.status).toBe(200);
    const sessions = await res.json();
    expect(sessions).toHaveLength(2);
  });
});

describe("GET /api/sessions/:id", () => {
  it("returns session with messages", async () => {
    const createRes = await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    const { session } = await createRes.json();

    const res = await fetch(`${server.baseUrl}/api/sessions/${session.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session.id).toBe(session.id);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].content).toBe("hello");
  });

  it("returns 404 for unknown session", async () => {
    const res = await fetch(`${server.baseUrl}/api/sessions/00000000-0000-0000-0000-000000000000`);
    expect(res.status).toBe(404);
  });
});
