import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  startTestServer,
  cleanupDb,
  closeDb,
  sql,
  type TestServer,
} from "./setup.js";
import { MessageRole, ContextStatus } from "@simple-coder/shared";
import {
  createMessage,
  updateContextStatus,
  createSummary,
  deleteSummary,
  getActiveMessages,
  getContextStatus,
  getSummariesForSession,
  estimateTokens,
  createSession,
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

describe("estimateTokens", () => {
  it("returns reasonable token estimates", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("hello")).toBe(2); // 5/4 = 1.25 → ceil = 2
    expect(estimateTokens("a".repeat(100))).toBe(25);
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });
});

describe("Context status on messages", () => {
  it("new messages default to active context status", async () => {
    const session = await createSession(sql, "test");
    const msg = await createMessage(sql, session.id, MessageRole.User, "hello");
    expect(msg.contextStatus).toBe("active");
  });

  it("messages get token counts on creation", async () => {
    const session = await createSession(sql, "test");
    const msg = await createMessage(sql, session.id, MessageRole.User, "hello world");
    expect(msg.tokenCount).toBeGreaterThan(0);
  });

  it("updateContextStatus changes status to inactive", async () => {
    const session = await createSession(sql, "test");
    const msg = await createMessage(sql, session.id, MessageRole.User, "hello");

    const updated = await updateContextStatus(sql, msg.id, ContextStatus.Inactive);
    expect(updated).not.toBeNull();
    expect(updated!.contextStatus).toBe("inactive");
  });

  it("updateContextStatus changes status back to active", async () => {
    const session = await createSession(sql, "test");
    const msg = await createMessage(sql, session.id, MessageRole.User, "hello");

    await updateContextStatus(sql, msg.id, ContextStatus.Inactive);
    const restored = await updateContextStatus(sql, msg.id, ContextStatus.Active);
    expect(restored!.contextStatus).toBe("active");
  });
});

describe("Summary CRUD", () => {
  it("creates a summary over active messages", async () => {
    const session = await createSession(sql, "test");
    const msg1 = await createMessage(sql, session.id, MessageRole.User, "first message");
    const msg2 = await createMessage(sql, session.id, MessageRole.Assistant, "first reply");
    const msg3 = await createMessage(sql, session.id, MessageRole.User, "second message");

    const summary = await createSummary(
      sql,
      session.id,
      "User asked about X, assistant replied with Y",
      "agent",
      [msg1.id, msg2.id],
    );

    expect(summary.sessionId).toBe(session.id);
    expect(summary.content).toBe("User asked about X, assistant replied with Y");
    expect(summary.createdBy).toBe("agent");
    expect(summary.messageIds).toHaveLength(2);
    expect(summary.tokenCount).toBeGreaterThan(0);
    // positionAt should be the earliest message's createdAt
    expect(String(summary.positionAt)).toBe(String(msg1.createdAt));
  });

  it("sets summarized messages to contextStatus=summarized", async () => {
    const session = await createSession(sql, "test");
    const msg1 = await createMessage(sql, session.id, MessageRole.User, "first");
    const msg2 = await createMessage(sql, session.id, MessageRole.Assistant, "reply");

    await createSummary(sql, session.id, "Summary text", "user", [msg1.id, msg2.id]);

    // Check messages are now summarized
    const rows = await sql`SELECT context_status FROM messages WHERE id = ANY(${[msg1.id, msg2.id]})`;
    for (const row of rows) {
      expect(row.context_status).toBe("summarized");
    }
  });

  it("rejects summarizing non-active messages", async () => {
    const session = await createSession(sql, "test");
    const msg = await createMessage(sql, session.id, MessageRole.User, "hello");

    // Set to inactive first
    await updateContextStatus(sql, msg.id, ContextStatus.Inactive);

    await expect(
      createSummary(sql, session.id, "Summary", "agent", [msg.id]),
    ).rejects.toThrow("not active");
  });

  it("rejects summarizing already-summarized messages", async () => {
    const session = await createSession(sql, "test");
    const msg1 = await createMessage(sql, session.id, MessageRole.User, "first");
    const msg2 = await createMessage(sql, session.id, MessageRole.User, "second");

    // Summarize msg1
    await createSummary(sql, session.id, "Summary 1", "agent", [msg1.id]);

    // Try to summarize msg1 again (now it's "summarized")
    await expect(
      createSummary(sql, session.id, "Summary 2", "agent", [msg1.id]),
    ).rejects.toThrow("not active");
  });

  it("enforces unique message constraint (Rule 1)", async () => {
    const session = await createSession(sql, "test");
    const msg1 = await createMessage(sql, session.id, MessageRole.User, "first");
    const msg2 = await createMessage(sql, session.id, MessageRole.User, "second");
    const msg3 = await createMessage(sql, session.id, MessageRole.User, "third");

    // First summary uses msg1
    await createSummary(sql, session.id, "Summary 1", "agent", [msg1.id]);

    // Second summary tries msg2 + msg3 — should work since msg1 is already summarized
    // and won't pass the active check. But msg2 and msg3 are still active.
    const summary2 = await createSummary(sql, session.id, "Summary 2", "agent", [msg2.id, msg3.id]);
    expect(summary2.messageIds).toHaveLength(2);
  });

  it("deletes a summary and restores messages", async () => {
    const session = await createSession(sql, "test");
    const msg1 = await createMessage(sql, session.id, MessageRole.User, "first");
    const msg2 = await createMessage(sql, session.id, MessageRole.Assistant, "reply");

    const summary = await createSummary(sql, session.id, "Summary", "agent", [msg1.id, msg2.id]);

    const result = await deleteSummary(sql, summary.id);
    expect(result).not.toBeNull();
    expect(result!.restoredMessageIds).toHaveLength(2);

    // Messages should be active again
    const rows = await sql`SELECT context_status FROM messages WHERE id = ANY(${[msg1.id, msg2.id]})`;
    for (const row of rows) {
      expect(row.context_status).toBe("active");
    }

    // Summary should be gone
    const summaries = await getSummariesForSession(sql, session.id);
    expect(summaries).toHaveLength(0);
  });

  it("deleteSummary returns null for unknown id", async () => {
    const result = await deleteSummary(sql, "00000000-0000-0000-0000-000000000000");
    expect(result).toBeNull();
  });
});

describe("getActiveMessages", () => {
  it("returns only active messages and summaries", async () => {
    const session = await createSession(sql, "test");
    const msg1 = await createMessage(sql, session.id, MessageRole.User, "first");
    const msg2 = await createMessage(sql, session.id, MessageRole.Assistant, "reply");
    const msg3 = await createMessage(sql, session.id, MessageRole.User, "second");

    // Summarize msg1 and msg2
    await createSummary(sql, session.id, "Summary of first exchange", "agent", [msg1.id, msg2.id]);

    const result = await getActiveMessages(sql, session.id);

    // Only msg3 should be active
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].id).toBe(msg3.id);

    // One summary should exist
    expect(result.summaries).toHaveLength(1);
    expect(result.summaries[0].content).toBe("Summary of first exchange");
  });

  it("excludes inactive messages", async () => {
    const session = await createSession(sql, "test");
    const msg1 = await createMessage(sql, session.id, MessageRole.User, "first");
    const msg2 = await createMessage(sql, session.id, MessageRole.User, "second");

    await updateContextStatus(sql, msg1.id, ContextStatus.Inactive);

    const result = await getActiveMessages(sql, session.id);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].id).toBe(msg2.id);
  });
});

describe("getContextStatus", () => {
  it("returns token counts for all messages", async () => {
    const session = await createSession(sql, "test");
    await createMessage(sql, session.id, MessageRole.User, "hello world");
    await createMessage(sql, session.id, MessageRole.Assistant, "hi there");

    const status = await getContextStatus(sql, session.id);
    expect(status.messages).toHaveLength(2);
    expect(status.usedTokens).toBeGreaterThan(0);

    // All messages active → usedTokens = sum of all token counts
    const totalTokens = status.messages.reduce((sum, m) => sum + (m.tokenCount ?? 0), 0);
    expect(status.usedTokens).toBe(totalTokens);
  });

  it("excludes inactive message tokens from usedTokens", async () => {
    const session = await createSession(sql, "test");
    const msg1 = await createMessage(sql, session.id, MessageRole.User, "hello world");
    const msg2 = await createMessage(sql, session.id, MessageRole.Assistant, "hi there");

    const statusBefore = await getContextStatus(sql, session.id);
    const totalBefore = statusBefore.usedTokens;

    // Drop msg1
    await updateContextStatus(sql, msg1.id, ContextStatus.Inactive);

    const statusAfter = await getContextStatus(sql, session.id);
    expect(statusAfter.usedTokens).toBeLessThan(totalBefore);
    expect(statusAfter.messages).toHaveLength(2); // still returns all messages
  });
});
