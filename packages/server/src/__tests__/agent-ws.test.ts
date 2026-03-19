import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startTestServer, connectAgent, cleanupDb, closeDb, type TestServer } from "./setup.js";

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
  // Restart server to clear connection state
  await server.close();
  server = await startTestServer();
});

describe("Agent authentication", () => {
  it("accepts agent with valid secret", async () => {
    const agent = await connectAgent(server.port, "test-agent", "change-me");
    const msg = await agent.waitFor("agent:registered");
    expect(msg.type).toBe("agent:registered");
    agent.ws.close();
  });

  it("rejects agent with invalid secret", async () => {
    const agent = await connectAgent(server.port, "test-agent", "wrong-secret");
    const msg = await agent.waitFor("error");
    expect(msg.message).toBe("invalid secret");

    // Wait for close
    await new Promise<void>((resolve) => {
      agent.ws.on("close", () => resolve());
    });
  });
});

describe("Session dispatch", () => {
  it("dispatches pending session to idle agent", async () => {
    // Create a session first
    await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });

    // Connect agent and signal ready
    const agent = await connectAgent(server.port, "test-agent");
    await agent.waitFor("agent:registered");
    agent.ws.send(JSON.stringify({ type: "agent:ready" }));

    // Agent should receive session:assign
    const assign = await agent.waitFor("session:assign");
    expect(assign.type).toBe("session:assign");
    expect((assign.session as { state: string }).state).toBe("active");
    expect(assign.messages).toHaveLength(1);

    agent.ws.close();
  });

  it("keeps session pending when no agent is connected", async () => {
    const createRes = await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    const { session } = await createRes.json();

    const res = await fetch(`${server.baseUrl}/api/sessions/${session.id}`);
    const body = await res.json();
    expect(body.session.state).toBe("pending");
  });
});

describe("Agent disconnect", () => {
  it("returns active session to pending when agent disconnects", async () => {
    // Create a session
    const createRes = await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    const { session } = await createRes.json();

    // Connect agent and get session assigned
    const agent = await connectAgent(server.port, "test-agent");
    await agent.waitFor("agent:registered");
    agent.ws.send(JSON.stringify({ type: "agent:ready" }));
    await agent.waitFor("session:assign");

    // Verify session is active
    let res = await fetch(`${server.baseUrl}/api/sessions/${session.id}`);
    let body = await res.json();
    expect(body.session.state).toBe("active");

    // Disconnect agent
    agent.ws.close();
    // Give server time to process the disconnect
    await new Promise((r) => setTimeout(r, 200));

    // Session should be back to pending
    res = await fetch(`${server.baseUrl}/api/sessions/${session.id}`);
    body = await res.json();
    expect(body.session.state).toBe("pending");
  });
});
