import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  startTestServer,
  cleanupDb,
  closeDb,
  sql,
  type TestServer,
} from "./setup.js";
import { MessageRole } from "@simple-coder/shared";
import { createSession, createMessage } from "../db/queries.js";

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

describe("PATCH /api/messages/:id/context-status", () => {
  it("sets a message to inactive", async () => {
    const session = await createSession(sql, "test");
    const msg = await createMessage(sql, session.id, MessageRole.User, "hello");

    const res = await fetch(`${server.baseUrl}/api/messages/${msg.id}/context-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "inactive" }),
    });
    expect(res.status).toBe(200);

    // Verify via GET context
    const ctxRes = await fetch(`${server.baseUrl}/api/sessions/${session.id}/context`);
    const ctx = await ctxRes.json();
    const found = ctx.messages.find((m: any) => m.id === msg.id);
    expect(found.contextStatus).toBe("inactive");
  });

  it("restores an inactive message to active", async () => {
    const session = await createSession(sql, "test");
    const msg = await createMessage(sql, session.id, MessageRole.User, "hello");

    // Set inactive
    await fetch(`${server.baseUrl}/api/messages/${msg.id}/context-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "inactive" }),
    });

    // Restore to active
    const res = await fetch(`${server.baseUrl}/api/messages/${msg.id}/context-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    expect(res.status).toBe(200);

    const ctxRes = await fetch(`${server.baseUrl}/api/sessions/${session.id}/context`);
    const ctx = await ctxRes.json();
    const found = ctx.messages.find((m: any) => m.id === msg.id);
    expect(found.contextStatus).toBe("active");
  });

  it("restoring a summarized message deletes the summary", async () => {
    const session = await createSession(sql, "test");
    const msg1 = await createMessage(sql, session.id, MessageRole.User, "first");
    const msg2 = await createMessage(sql, session.id, MessageRole.Assistant, "reply");

    // Create a summary
    const summaryRes = await fetch(`${server.baseUrl}/api/sessions/${session.id}/summaries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Summary text",
        messageIds: [msg1.id, msg2.id],
        createdBy: "user",
      }),
    });
    expect(summaryRes.status).toBe(201);

    // Restore msg1 (which is summarized) → should delete the summary
    const res = await fetch(`${server.baseUrl}/api/messages/${msg1.id}/context-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    expect(res.status).toBe(200);

    // Both messages should be active now (summary deleted restores all)
    const ctxRes = await fetch(`${server.baseUrl}/api/sessions/${session.id}/context`);
    const ctx = await ctxRes.json();
    for (const m of ctx.messages) {
      expect(m.contextStatus).toBe("active");
    }

    // Session should have no summaries
    const sessionRes = await fetch(`${server.baseUrl}/api/sessions/${session.id}`);
    const sessionBody = await sessionRes.json();
    expect(sessionBody.summaries).toHaveLength(0);
  });

  it("returns 404 for unknown message", async () => {
    const res = await fetch(`${server.baseUrl}/api/messages/00000000-0000-0000-0000-000000000000/context-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "inactive" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid status", async () => {
    const session = await createSession(sql, "test");
    const msg = await createMessage(sql, session.id, MessageRole.User, "hello");

    const res = await fetch(`${server.baseUrl}/api/messages/${msg.id}/context-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "summarized" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/sessions/:id/summaries", () => {
  it("creates a summary over active messages", async () => {
    const session = await createSession(sql, "test");
    const msg1 = await createMessage(sql, session.id, MessageRole.User, "first");
    const msg2 = await createMessage(sql, session.id, MessageRole.Assistant, "reply");
    const msg3 = await createMessage(sql, session.id, MessageRole.User, "second");

    const res = await fetch(`${server.baseUrl}/api/sessions/${session.id}/summaries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "User asked, assistant replied",
        messageIds: [msg1.id, msg2.id],
        createdBy: "agent",
      }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.summary.content).toBe("User asked, assistant replied");
    expect(body.summary.messageIds).toHaveLength(2);

    // Verify messages are now summarized
    const ctxRes = await fetch(`${server.baseUrl}/api/sessions/${session.id}/context`);
    const ctx = await ctxRes.json();
    const m1 = ctx.messages.find((m: any) => m.id === msg1.id);
    const m2 = ctx.messages.find((m: any) => m.id === msg2.id);
    const m3 = ctx.messages.find((m: any) => m.id === msg3.id);
    expect(m1.contextStatus).toBe("summarized");
    expect(m2.contextStatus).toBe("summarized");
    expect(m3.contextStatus).toBe("active");
  });

  it("rejects summarizing inactive messages", async () => {
    const session = await createSession(sql, "test");
    const msg = await createMessage(sql, session.id, MessageRole.User, "hello");

    // Drop message first
    await fetch(`${server.baseUrl}/api/messages/${msg.id}/context-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "inactive" }),
    });

    const res = await fetch(`${server.baseUrl}/api/sessions/${session.id}/summaries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Summary",
        messageIds: [msg.id],
        createdBy: "user",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects summarizing already-summarized messages", async () => {
    const session = await createSession(sql, "test");
    const msg1 = await createMessage(sql, session.id, MessageRole.User, "first");
    const msg2 = await createMessage(sql, session.id, MessageRole.User, "second");

    // Summarize msg1
    await fetch(`${server.baseUrl}/api/sessions/${session.id}/summaries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Summary 1",
        messageIds: [msg1.id],
        createdBy: "agent",
      }),
    });

    // Try to summarize msg1 again
    const res = await fetch(`${server.baseUrl}/api/sessions/${session.id}/summaries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Summary 2",
        messageIds: [msg1.id],
        createdBy: "agent",
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/summaries/:id", () => {
  it("deletes a summary and restores messages", async () => {
    const session = await createSession(sql, "test");
    const msg1 = await createMessage(sql, session.id, MessageRole.User, "first");
    const msg2 = await createMessage(sql, session.id, MessageRole.Assistant, "reply");

    // Create summary
    const createRes = await fetch(`${server.baseUrl}/api/sessions/${session.id}/summaries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Summary",
        messageIds: [msg1.id, msg2.id],
        createdBy: "user",
      }),
    });
    const { summary } = await createRes.json();

    // Delete summary
    const res = await fetch(`${server.baseUrl}/api/summaries/${summary.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);

    // Messages should be active again
    const ctxRes = await fetch(`${server.baseUrl}/api/sessions/${session.id}/context`);
    const ctx = await ctxRes.json();
    for (const m of ctx.messages) {
      expect(m.contextStatus).toBe("active");
    }
  });

  it("returns 404 for unknown summary", async () => {
    const res = await fetch(`${server.baseUrl}/api/summaries/00000000-0000-0000-0000-000000000000`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/sessions/:id/context", () => {
  it("returns token counts and message states", async () => {
    const session = await createSession(sql, "test");
    await createMessage(sql, session.id, MessageRole.User, "hello world");
    await createMessage(sql, session.id, MessageRole.Assistant, "hi there");

    const res = await fetch(`${server.baseUrl}/api/sessions/${session.id}/context`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.messages).toHaveLength(2);
    expect(body.usedTokens).toBeGreaterThan(0);
    expect(body.maxTokens).toBe(128000);
  });

  it("inactive messages reduce usedTokens", async () => {
    const session = await createSession(sql, "test");
    const msg1 = await createMessage(sql, session.id, MessageRole.User, "hello world");
    await createMessage(sql, session.id, MessageRole.Assistant, "hi there");

    const beforeRes = await fetch(`${server.baseUrl}/api/sessions/${session.id}/context`);
    const before = await beforeRes.json();

    // Drop msg1
    await fetch(`${server.baseUrl}/api/messages/${msg1.id}/context-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "inactive" }),
    });

    const afterRes = await fetch(`${server.baseUrl}/api/sessions/${session.id}/context`);
    const after = await afterRes.json();
    expect(after.usedTokens).toBeLessThan(before.usedTokens);
  });
});

describe("GET /api/sessions/:id includes summaries", () => {
  it("includes summaries in session response", async () => {
    const session = await createSession(sql, "test");
    const msg1 = await createMessage(sql, session.id, MessageRole.User, "first");
    const msg2 = await createMessage(sql, session.id, MessageRole.Assistant, "reply");

    await fetch(`${server.baseUrl}/api/sessions/${session.id}/summaries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Summary of exchange",
        messageIds: [msg1.id, msg2.id],
        createdBy: "agent",
      }),
    });

    const res = await fetch(`${server.baseUrl}/api/sessions/${session.id}`);
    const body = await res.json();
    expect(body.summaries).toHaveLength(1);
    expect(body.summaries[0].content).toBe("Summary of exchange");
  });

  it("returns empty summaries array when none exist", async () => {
    const session = await createSession(sql, "test");
    await createMessage(sql, session.id, MessageRole.User, "hello");

    const res = await fetch(`${server.baseUrl}/api/sessions/${session.id}`);
    const body = await res.json();
    expect(body.summaries).toHaveLength(0);
  });
});
