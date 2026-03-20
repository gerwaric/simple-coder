import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  startTestServer,
  connectAgent,
  connectUi,
  cleanupDb,
  closeDb,
  sql,
  type TestServer,
} from "./setup.js";
import { getMessageByToolCallId } from "../db/queries.js";

let server: TestServer;
const openWs: Array<{ close: () => void }> = [];

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  for (const ws of openWs) ws.close();
  openWs.length = 0;
  await server.close();
  await closeDb();
});

beforeEach(async () => {
  for (const ws of openWs) ws.close();
  openWs.length = 0;
  await cleanupDb();
});

// Helper: set up agent with a session and send a tool:approval:request
async function setupPendingToolCall(
  toolCallId: string,
  toolName = "bash",
  args: Record<string, unknown> = { command: "ls" },
) {
  const agent = await connectAgent(server.port, `agent-${toolCallId}`);
  await agent.waitFor("agent:registered");
  agent.ws.send(JSON.stringify({ type: "agent:ready" }));

  const createRes = await fetch(`${server.baseUrl}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "do something" }),
  });
  const { session } = await createRes.json();

  await agent.waitFor("session:assign");

  // Agent sends tool:approval:request
  agent.ws.send(
    JSON.stringify({
      type: "tool:approval:request",
      sessionId: session.id,
      toolCallId,
      toolName,
      args,
    }),
  );

  // Wait a tick for the server to persist
  await new Promise((r) => setTimeout(r, 100));

  openWs.push(agent.ws);
  return { agent, session };
}

describe("POST /api/tools/:toolCallId/approve", () => {
  it("approves a pending tool call", async () => {
    const { agent } = await setupPendingToolCall("approve-test-1");

    const res = await fetch(`${server.baseUrl}/api/tools/approve-test-1/approve`, {
      method: "POST",
    });
    expect(res.status).toBe(200);

    // Verify DB updated
    const msg = await getMessageByToolCallId(sql, "approve-test-1");
    expect(msg!.approvalStatus).toBe("approved");

    // Agent receives approval response
    const approval = await agent.waitFor("tool:approval:response");
    expect(approval.approved).toBe(true);
    expect(approval.toolCallId).toBe("approve-test-1");

  });

  it("returns 404 for unknown toolCallId", async () => {
    const res = await fetch(`${server.baseUrl}/api/tools/nonexistent/approve`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for already-approved tool call", async () => {
    await setupPendingToolCall("double-approve-1");

    // First approve
    await fetch(`${server.baseUrl}/api/tools/double-approve-1/approve`, {
      method: "POST",
    });

    // Second approve
    const res = await fetch(`${server.baseUrl}/api/tools/double-approve-1/approve`, {
      method: "POST",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("already");
  });
});

describe("POST /api/tools/:toolCallId/reject", () => {
  it("rejects a pending tool call", async () => {
    const { agent } = await setupPendingToolCall("reject-test-1");

    const res = await fetch(`${server.baseUrl}/api/tools/reject-test-1/reject`, {
      method: "POST",
    });
    expect(res.status).toBe(200);

    // Verify DB updated
    const msg = await getMessageByToolCallId(sql, "reject-test-1");
    expect(msg!.approvalStatus).toBe("rejected");

    // Agent receives rejection
    const rejection = await agent.waitFor("tool:approval:response");
    expect(rejection.approved).toBe(false);
    expect(rejection.toolCallId).toBe("reject-test-1");
  });

  it("returns 404 for unknown toolCallId", async () => {
    const res = await fetch(`${server.baseUrl}/api/tools/nonexistent/reject`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/tools/:toolCallId/respond", () => {
  it("responds to an ask_human tool call with text", async () => {
    const { agent } = await setupPendingToolCall(
      "respond-test-1",
      "ask_human",
      { question: "What should I do?" },
    );

    const res = await fetch(`${server.baseUrl}/api/tools/respond-test-1/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: "Please use TypeScript" }),
    });
    expect(res.status).toBe(200);

    // Verify DB updated
    const msg = await getMessageByToolCallId(sql, "respond-test-1");
    expect(msg!.approvalStatus).toBe("approved");

    // Agent receives response with text
    const approval = await agent.waitFor("tool:approval:response");
    expect(approval.approved).toBe(true);
    expect(approval.response).toBe("Please use TypeScript");
  });

  it("returns 400 if response is missing", async () => {
    await setupPendingToolCall("respond-test-2", "ask_human", { question: "?" });

    const res = await fetch(`${server.baseUrl}/api/tools/respond-test-2/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown toolCallId", async () => {
    const res = await fetch(`${server.baseUrl}/api/tools/nonexistent/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: "hello" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("UI receives approval updates", () => {
  it("UI sees tool:approval:request then updated message on approve", async () => {
    const ui = await connectUi(server.port);
    openWs.push(ui.ws);
    const { agent } = await setupPendingToolCall("ui-approve-1");

    // UI should have received the tool:approval:request
    const approvalReq = await ui.waitFor("tool:approval:request");
    expect((approvalReq as any).toolCallId).toBe("ui-approve-1");

    // Approve it
    await fetch(`${server.baseUrl}/api/tools/ui-approve-1/approve`, {
      method: "POST",
    });

    // UI receives message:complete with updated approval status
    const complete = await ui.waitFor("message:complete");
    expect((complete as any).message.approvalStatus).toBe("approved");
  });
});
