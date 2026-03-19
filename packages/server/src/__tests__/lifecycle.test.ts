import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  startTestServer,
  connectAgent,
  connectUi,
  cleanupDb,
  closeDb,
  type TestServer,
} from "./setup.js";

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
  await closeDb();
});

beforeEach(async () => {
  await server.close();
  server = await startTestServer();
});

describe("Full session lifecycle", () => {
  it("create → dispatch → respond → stop", async () => {
    // Connect UI client
    const ui = await connectUi(server.port);

    // Connect agent
    const agent = await connectAgent(server.port, "test-agent");
    await agent.waitFor("agent:registered");
    agent.ws.send(JSON.stringify({ type: "agent:ready" }));

    // Create session via API
    const createRes = await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "What is 2+2?" }),
    });
    expect(createRes.status).toBe(201);
    const { session } = await createRes.json();

    // Agent receives session assignment
    const assign = await agent.waitFor("session:assign");
    expect((assign.session as { id: string }).id).toBe(session.id);

    // UI receives session:updated with state=active (may also get pending first)
    const activeUpdate = await ui.waitFor(
      (msg) =>
        msg.type === "session:updated" &&
        (msg as { session: { state: string } }).session.state === "active",
    );
    expect(activeUpdate).toBeDefined();

    // Agent streams thinking token
    agent.ws.send(
      JSON.stringify({
        type: "thinking:token",
        sessionId: session.id,
        token: "Let me think...",
      }),
    );

    // UI receives thinking:stream
    const thinkingStream = await ui.waitFor("thinking:stream");
    expect((thinkingStream as { token: string }).token).toBe("Let me think...");

    // Agent streams response token
    agent.ws.send(
      JSON.stringify({
        type: "assistant:token",
        sessionId: session.id,
        token: "The answer is 4",
      }),
    );

    // UI receives token:stream
    const tokenStream = await ui.waitFor("token:stream");
    expect((tokenStream as { token: string }).token).toBe("The answer is 4");

    // Agent sends complete message
    agent.ws.send(
      JSON.stringify({
        type: "assistant:message:complete",
        sessionId: session.id,
        content: "The answer is 4",
        thinking: "Let me think...",
      }),
    );

    // UI receives message:complete
    const messageComplete = await ui.waitFor("message:complete");
    expect((messageComplete as { message: { content: string } }).message.content).toBe(
      "The answer is 4",
    );
    expect((messageComplete as { message: { thinking: string } }).message.thinking).toBe(
      "Let me think...",
    );

    // Verify message is persisted in DB
    const getRes = await fetch(`${server.baseUrl}/api/sessions/${session.id}`);
    const getBody = await getRes.json();
    expect(getBody.messages).toHaveLength(2); // user + assistant
    expect(getBody.messages[1].content).toBe("The answer is 4");
    expect(getBody.messages[1].thinking).toBe("Let me think...");

    // Send follow-up message
    const followUpRes = await fetch(`${server.baseUrl}/api/sessions/${session.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Thanks!" }),
    });
    expect(followUpRes.status).toBe(201);

    // Agent receives user:message
    const userMsg = await agent.waitFor("user:message");
    expect((userMsg.message as { content: string }).content).toBe("Thanks!");

    // Stop session
    const stopRes = await fetch(`${server.baseUrl}/api/sessions/${session.id}/stop`, {
      method: "POST",
    });
    expect(stopRes.status).toBe(200);

    // Agent receives session:stop
    const stopMsg = await agent.waitFor("session:stop");
    expect(stopMsg.sessionId).toBe(session.id);

    // Verify session is stopped
    const finalRes = await fetch(`${server.baseUrl}/api/sessions/${session.id}`);
    const finalBody = await finalRes.json();
    expect(finalBody.session.state).toBe("stopped");

    // Cleanup
    ui.ws.close();
    agent.ws.close();
  });

  it("new agent picks up pending session after previous agent disconnects", async () => {
    // Create a session
    const createRes = await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    const { session } = await createRes.json();

    // First agent connects, gets session, then disconnects
    const agent1 = await connectAgent(server.port, "agent-1");
    await agent1.waitFor("agent:registered");
    agent1.ws.send(JSON.stringify({ type: "agent:ready" }));
    await agent1.waitFor("session:assign");
    agent1.ws.close();

    // Wait for disconnect to process
    await new Promise((r) => setTimeout(r, 300));

    // Verify session is pending again
    let res = await fetch(`${server.baseUrl}/api/sessions/${session.id}`);
    let body = await res.json();
    expect(body.session.state).toBe("pending");

    // Second agent connects and signals ready
    const agent2 = await connectAgent(server.port, "agent-2");
    await agent2.waitFor("agent:registered");
    agent2.ws.send(JSON.stringify({ type: "agent:ready" }));

    // Second agent should receive the session
    const assign = await agent2.waitFor("session:assign");
    expect((assign.session as { id: string }).id).toBe(session.id);

    // Session should be active again
    res = await fetch(`${server.baseUrl}/api/sessions/${session.id}`);
    body = await res.json();
    expect(body.session.state).toBe("active");

    agent2.ws.close();
  });
});
