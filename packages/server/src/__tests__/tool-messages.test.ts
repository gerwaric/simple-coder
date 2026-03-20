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
import { MessageRole, ApprovalStatus } from "@simple-coder/shared";
import {
  createMessage,
  getMessageByToolCallId,
  updateApprovalStatus,
  getMessageById,
} from "../db/queries.js";

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

describe("Tool message persistence", () => {
  it("persists a tool_call message with tool fields", async () => {
    // Create a session first
    const createRes = await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    const { session } = await createRes.json();

    const msg = await createMessage(
      sql,
      session.id,
      MessageRole.ToolCall,
      "",
      null,
      {
        toolName: "bash",
        toolArgs: { command: "ls -la" },
        toolCallId: "test-call-123",
        approvalStatus: ApprovalStatus.Pending,
      },
    );

    expect(msg.role).toBe("tool_call");
    expect(msg.toolName).toBe("bash");
    expect(msg.toolArgs).toEqual({ command: "ls -la" });
    expect(msg.toolCallId).toBe("test-call-123");
    expect(msg.approvalStatus).toBe("pending");
  });

  it("persists a tool_result message", async () => {
    const createRes = await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    const { session } = await createRes.json();

    const msg = await createMessage(
      sql,
      session.id,
      MessageRole.ToolResult,
      '{"stdout":"file1.txt\\nfile2.txt","exitCode":0}',
      null,
      {
        toolName: "bash",
        toolCallId: "test-call-456",
      },
    );

    expect(msg.role).toBe("tool_result");
    expect(msg.toolName).toBe("bash");
    expect(msg.toolCallId).toBe("test-call-456");
    expect(msg.approvalStatus).toBeNull();
  });

  it("regular messages have null tool fields", async () => {
    const createRes = await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    const { session, message } = await createRes.json();

    expect(message.toolName).toBeNull();
    expect(message.toolArgs).toBeNull();
    expect(message.toolCallId).toBeNull();
    expect(message.approvalStatus).toBeNull();
  });
});

describe("Tool query functions", () => {
  it("getMessageByToolCallId finds a tool_call message", async () => {
    const createRes = await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    const { session } = await createRes.json();

    await createMessage(sql, session.id, MessageRole.ToolCall, "", null, {
      toolName: "bash",
      toolArgs: { command: "pwd" },
      toolCallId: "lookup-test-id",
      approvalStatus: ApprovalStatus.Pending,
    });

    const found = await getMessageByToolCallId(sql, "lookup-test-id");
    expect(found).not.toBeNull();
    expect(found!.toolCallId).toBe("lookup-test-id");
    expect(found!.toolName).toBe("bash");
  });

  it("getMessageByToolCallId returns null for unknown id", async () => {
    const found = await getMessageByToolCallId(sql, "nonexistent-id");
    expect(found).toBeNull();
  });

  it("updateApprovalStatus changes status", async () => {
    const createRes = await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    const { session } = await createRes.json();

    const msg = await createMessage(sql, session.id, MessageRole.ToolCall, "", null, {
      toolName: "write_file",
      toolArgs: { path: "/tmp/test.txt", content: "hello" },
      toolCallId: "approval-test-id",
      approvalStatus: ApprovalStatus.Pending,
    });

    const updated = await updateApprovalStatus(sql, msg.id, ApprovalStatus.Approved);
    expect(updated).not.toBeNull();
    expect(updated!.approvalStatus).toBe("approved");

    // Verify via direct lookup
    const refetched = await getMessageById(sql, msg.id);
    expect(refetched!.approvalStatus).toBe("approved");
  });
});

describe("Tool call WebSocket flow", () => {
  it("agent tool:call is persisted and broadcast to UI", async () => {
    const ui = await connectUi(server.port);
    const agent = await connectAgent(server.port, "tool-agent");
    await agent.waitFor("agent:registered");
    agent.ws.send(JSON.stringify({ type: "agent:ready" }));

    // Create session
    const createRes = await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "list files" }),
    });
    const { session } = await createRes.json();

    // Agent receives assignment
    await agent.waitFor("session:assign");

    // Agent sends tool:call (safe tool, already executed)
    agent.ws.send(
      JSON.stringify({
        type: "tool:call",
        sessionId: session.id,
        toolCallId: "ws-call-001",
        toolName: "read_file",
        args: { path: "/workspace/README.md" },
      }),
    );

    // UI receives tool:call
    const uiMsg = await ui.waitFor("tool:call");
    expect((uiMsg as any).toolCallId).toBe("ws-call-001");
    expect((uiMsg as any).toolName).toBe("read_file");

    // Verify persisted in DB
    const found = await getMessageByToolCallId(sql, "ws-call-001");
    expect(found).not.toBeNull();
    expect(found!.role).toBe("tool_call");
    expect(found!.toolName).toBe("read_file");

    ui.ws.close();
    agent.ws.close();
  });

  it("agent tool:approval:request is persisted with pending status and broadcast to UI", async () => {
    const ui = await connectUi(server.port);
    const agent = await connectAgent(server.port, "approval-agent");
    await agent.waitFor("agent:registered");
    agent.ws.send(JSON.stringify({ type: "agent:ready" }));

    const createRes = await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "run a command" }),
    });
    const { session } = await createRes.json();

    await agent.waitFor("session:assign");

    // Agent sends tool:approval:request
    agent.ws.send(
      JSON.stringify({
        type: "tool:approval:request",
        sessionId: session.id,
        toolCallId: "ws-approval-001",
        toolName: "bash",
        args: { command: "rm -rf /tmp/test" },
      }),
    );

    // UI receives tool:approval:request
    const uiMsg = await ui.waitFor("tool:approval:request");
    expect((uiMsg as any).toolCallId).toBe("ws-approval-001");
    expect((uiMsg as any).toolName).toBe("bash");

    // Verify persisted with pending status
    const found = await getMessageByToolCallId(sql, "ws-approval-001");
    expect(found).not.toBeNull();
    expect(found!.approvalStatus).toBe("pending");

    ui.ws.close();
    agent.ws.close();
  });

  it("agent tool:result is persisted and broadcast to UI", async () => {
    const ui = await connectUi(server.port);
    const agent = await connectAgent(server.port, "result-agent");
    await agent.waitFor("agent:registered");
    agent.ws.send(JSON.stringify({ type: "agent:ready" }));

    const createRes = await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "read a file" }),
    });
    const { session } = await createRes.json();

    await agent.waitFor("session:assign");

    // Agent sends tool:result
    agent.ws.send(
      JSON.stringify({
        type: "tool:result",
        sessionId: session.id,
        toolCallId: "ws-result-001",
        toolName: "read_file",
        result: { content: "file contents here" },
      }),
    );

    // UI receives tool:result
    const uiMsg = await ui.waitFor("tool:result");
    expect((uiMsg as any).toolCallId).toBe("ws-result-001");
    expect((uiMsg as any).toolName).toBe("read_file");

    // Verify persisted
    const rows = await sql`SELECT * FROM messages WHERE tool_call_id = 'ws-result-001' AND role = 'tool_result'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].tool_name).toBe("read_file");

    ui.ws.close();
    agent.ws.close();
  });
});
