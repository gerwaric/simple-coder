import WebSocket from "ws";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Message, Summary } from "@simple-coder/shared";
import type { ServerToAgent, ToolApprovalResponse } from "@simple-coder/shared";
import { LlmClient } from "./llm.js";
import { agentTools } from "./tools.js";
import { executeTool } from "./tool-executor.js";
import { assessToolCall } from "./safety.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { toSdkMessages } from "./message-translator.js";

const LLM_MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS) || 128000;
const APPROVAL_TIMEOUT_MS = Number(process.env.APPROVAL_TIMEOUT_MS) || 5 * 60 * 1000; // 5 minutes

export class AgentConnection {
  private ws: WebSocket | null = null;
  private agentId: string;
  private serverUrl: string;
  private secret: string;
  private llm: LlmClient;
  private currentSessionId: string | null = null;
  private messageHistory: Message[] = [];
  private claudeMdContent: string | null = null;
  private abortController: AbortController | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = true;
  private approvalResolvers = new Map<string, (response: ToolApprovalResponse) => void>();

  constructor(agentId: string, serverUrl: string, secret: string) {
    this.agentId = agentId;
    this.serverUrl = serverUrl;
    this.secret = secret;
    this.llm = new LlmClient();
  }

  start(): void {
    this.shouldReconnect = true;
    this.connect();

    process.on("SIGTERM", () => this.shutdown());
    process.on("SIGINT", () => this.shutdown());
  }

  private connect(): void {
    console.log(`connecting to ${this.serverUrl}...`);
    this.ws = new WebSocket(this.serverUrl);

    this.ws.on("open", () => {
      console.log("connected to server");
      this.reconnectDelay = 1000;
      this.send({
        type: "agent:register",
        agentId: this.agentId,
        secret: this.secret,
      });
    });

    this.ws.on("message", (data) => {
      let msg: ServerToAgent & { type: string };
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      // Handle agent:registered confirmation
      if (msg.type === "agent:registered") {
        console.log("registered with server");
        this.send({ type: "agent:ready" });
        return;
      }

      if (msg.type === "error") {
        console.error("server error:", (msg as any).message);
        return;
      }

      this.handleMessage(msg).catch(console.error);
    });

    this.ws.on("close", () => {
      console.log("disconnected from server");
      this.ws = null;
      this.currentSessionId = null;
      this.abortController?.abort();
      this.abortController = null;

      if (this.shouldReconnect) {
        console.log(`reconnecting in ${this.reconnectDelay}ms...`);
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      }
    });

    this.ws.on("error", (err) => {
      console.error("ws error:", err.message);
    });
  }

  private async handleMessage(msg: ServerToAgent): Promise<void> {
    switch (msg.type) {
      case "session:assign": {
        console.log(`assigned session ${msg.session.id}`);
        this.currentSessionId = msg.session.id;
        this.messageHistory = msg.messages;
        this.claudeMdContent = null;
        if (msg.session.includeClaudeMd) {
          try {
            this.claudeMdContent = await readFile("/workspace/CLAUDE.md", "utf-8");
            console.log("loaded CLAUDE.md into system prompt");
          } catch {
            console.log("CLAUDE.md not found in workspace, skipping");
          }
        }
        await this.runToolLoop();
        if (this.currentSessionId) {
          console.log(`turn complete for session ${this.currentSessionId}`);
          this.send({ type: "turn:complete", sessionId: msg.session.id });
        }
        break;
      }

      case "user:message": {
        console.log(`received user message for session ${msg.message.sessionId}`);
        if (!this.currentSessionId) {
          console.log(`ignoring user message — no active session`);
          break;
        }
        this.messageHistory.push(msg.message);
        await this.runToolLoop();
        if (this.currentSessionId) {
          console.log(`turn complete for session ${this.currentSessionId}`);
          this.send({ type: "turn:complete", sessionId: msg.message.sessionId });
        }
        break;
      }

      case "session:stop": {
        console.log(`session ${msg.sessionId} stopped`);
        this.abortController?.abort();
        this.abortController = null;
        this.currentSessionId = null;
        this.messageHistory = [];
        this.claudeMdContent = null;
        // Reject any pending approval promises so runToolLoop can exit cleanly
        for (const [, resolver] of this.approvalResolvers) {
          resolver({ type: "tool:approval:response", toolCallId: "", approved: false });
        }
        this.approvalResolvers.clear();
        this.send({ type: "agent:ready" });
        break;
      }

      case "tool:approval:response": {
        const resolver = this.approvalResolvers.get(msg.toolCallId);
        if (resolver) {
          resolver(msg);
          this.approvalResolvers.delete(msg.toolCallId);
        }
        break;
      }

      case "context:updated": {
        // Update local message history to reflect context status changes from UI
        for (const msgId of msg.messageIds) {
          const m = this.messageHistory.find((h) => h.id === msgId);
          if (m) m.contextStatus = msg.contextStatus;
        }
        break;
      }

      case "summary:created": {
        // Mark summarized messages in local history
        for (const msgId of msg.summary.messageIds) {
          const m = this.messageHistory.find((h) => h.id === msgId);
          if (m) m.contextStatus = "summarized";
        }
        break;
      }

      case "summary:deleted": {
        // Restore messages to active
        for (const msgId of msg.restoredMessageIds) {
          const m = this.messageHistory.find((h) => h.id === msgId);
          if (m) m.contextStatus = "active";
        }
        break;
      }
    }
  }

  private async runToolLoop(): Promise<void> {
    if (!this.currentSessionId) return;

    const sessionId = this.currentSessionId;
    this.abortController = new AbortController();

    try {
      while (true) {
        // Filter to active messages only
        const activeMessages = this.messageHistory.filter((m) => m.contextStatus === "active");
        const usedTokens = activeMessages.reduce((sum, m) => sum + (m.tokenCount ?? 0), 0);
        const systemPrompt = buildSystemPrompt({ usedTokens, maxTokens: LLM_MAX_TOKENS, claudeMdContent: this.claudeMdContent });
        const sdkMessages = toSdkMessages(activeMessages);

        console.log(`[llm] calling streamText — ${sdkMessages.length} sdk messages, ~${usedTokens} tokens`);

        const result = this.llm.streamWithTools({
          system: systemPrompt,
          messages: sdkMessages,
          tools: agentTools,
          signal: this.abortController.signal,
        });

        // Stream thinking and text tokens
        let fullThinking = "";
        let fullContent = "";
        let thinkingComplete = false;
        let firstChunk = true;

        let streamError: any = null;
        for await (const part of result.fullStream) {
          if (firstChunk) {
            console.log(`[llm] first chunk received (type: ${part.type})`);
            firstChunk = false;
          }
          if (part.type === "error") {
            console.error(`[llm] stream error:`, part.error);
            streamError = part.error;
            break;
          }
          if (part.type === "reasoning") {
            fullThinking += part.textDelta;
            this.send({
              type: "thinking:token",
              sessionId,
              token: part.textDelta,
            });
          } else if (part.type === "text-delta") {
            if (!thinkingComplete && fullThinking) {
              thinkingComplete = true;
              this.send({
                type: "thinking:complete",
                sessionId,
                thinking: fullThinking,
              });
            }
            fullContent += part.textDelta;
            this.send({
              type: "assistant:token",
              sessionId,
              token: part.textDelta,
            });
          }
        }

        console.log(`[llm] stream complete — content: ${fullContent.length} chars, thinking: ${fullThinking.length} chars`);

        if (streamError) {
          const retryAt = this.extractRateLimitReset(streamError);
          if (retryAt) {
            const waitMs = Math.max(0, new Date(retryAt).getTime() - Date.now()) + 1000; // 1s buffer
            console.log(`[llm] rate limited — waiting ${Math.ceil(waitMs / 1000)}s until ${retryAt}`);
            this.send({
              type: "agent:warning",
              sessionId,
              message: "Rate limited by LLM provider — waiting for reset",
              retryAt,
            });
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            console.log(`[llm] retrying after rate limit`);
            continue; // retry the LLM call
          }
          console.error(`[llm] aborting tool loop due to stream error`);
          this.send({
            type: "agent:warning",
            sessionId,
            message: "LLM error — aborting current turn",
          });
          break;
        }

        // Get tool calls from the result
        const toolCalls = await result.toolCalls;
        const hasToolCalls = toolCalls && toolCalls.length > 0;
        console.log(`[llm] tool calls: ${hasToolCalls ? toolCalls.map((tc: any) => tc.toolName).join(", ") : "none"}`);

        if (fullContent || !hasToolCalls) {
          // Send the assistant message if there's content
          if (fullContent) {
            this.send({
              type: "assistant:message:complete",
              sessionId,
              content: fullContent,
              thinking: fullThinking || null,
            });

            this.messageHistory.push(this.makeMessage(sessionId, "assistant", fullContent, fullThinking || null));
          }
        }

        if (!hasToolCalls) {
          // No tool calls — we're done with this turn
          break;
        }

        // If there was assistant text before tool calls, we already added it above.
        // Now add an empty assistant message placeholder if needed for tool call grouping.
        // The SDK model may produce text + tool calls in one response.

        // Process each tool call
        for (const tc of toolCalls) {
          const toolCallId = randomUUID();
          const toolName = tc.toolName;
          const args = tc.args as Record<string, unknown>;
          const { action } = assessToolCall(toolName, args);

          console.log(`tool call: ${toolName} (${action}) — ${toolCallId}`);

          let toolResult: unknown;

          if (action === "execute") {
            // Safe tool — execute immediately, then notify server
            try {
              toolResult = await executeTool(toolName, args, sessionId);
            } catch (err: any) {
              toolResult = { error: err.message };
            }

            this.send({
              type: "tool:call",
              sessionId,
              toolCallId,
              toolName,
              args,
            });

            this.send({
              type: "tool:result",
              sessionId,
              toolCallId,
              toolName,
              result: toolResult,
            });
          } else if (action === "approve") {
            // Consequential tool — request approval, wait
            this.send({
              type: "tool:approval:request",
              sessionId,
              toolCallId,
              toolName,
              args,
            });

            const response = await this.waitForApproval(toolCallId);

            if (response.approved) {
              try {
                toolResult = await executeTool(toolName, args, sessionId);
              } catch (err: any) {
                toolResult = { error: err.message };
              }
            } else {
              toolResult = { rejected: true, message: "Tool call was rejected by the user" };
            }

            this.send({
              type: "tool:result",
              sessionId,
              toolCallId,
              toolName,
              result: toolResult,
            });
          } else if (action === "ask_human") {
            // ask_human — request response text from user
            this.send({
              type: "tool:approval:request",
              sessionId,
              toolCallId,
              toolName,
              args,
            });

            const response = await this.waitForApproval(toolCallId);
            toolResult = { response: response.response ?? "" };

            this.send({
              type: "tool:result",
              sessionId,
              toolCallId,
              toolName,
              result: toolResult,
            });
          }

          // Add tool_call and tool_result to local history
          this.messageHistory.push({
            id: "",
            sessionId,
            role: "tool_call",
            content: "",
            thinking: null,
            toolName,
            toolArgs: args,
            toolCallId,
            approvalStatus: null,
            contextStatus: "active",
            tokenCount: null,
            createdAt: new Date().toISOString(),
          });

          this.messageHistory.push({
            id: "",
            sessionId,
            role: "tool_result",
            content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult),
            thinking: null,
            toolName,
            toolArgs: null,
            toolCallId,
            approvalStatus: null,
            contextStatus: "active",
            tokenCount: null,
            createdAt: new Date().toISOString(),
          });
        }

        // Loop back for the next LLM call with tool results
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("LLM call aborted");
        return;
      }
      console.error("LLM error:", err.message);
      console.error("LLM error stack:", err.stack);
    } finally {
      this.abortController = null;
    }
  }

  private waitForApproval(toolCallId: string): Promise<ToolApprovalResponse> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.approvalResolvers.delete(toolCallId);
        console.warn(`approval timeout for ${toolCallId} — auto-rejecting`);
        resolve({ type: "tool:approval:response", toolCallId, approved: false });
      }, APPROVAL_TIMEOUT_MS);

      this.approvalResolvers.set(toolCallId, (response) => {
        clearTimeout(timer);
        resolve(response);
      });
    });
  }

  private makeMessage(
    sessionId: string,
    role: string,
    content: string,
    thinking: string | null,
  ): Message {
    return {
      id: "",
      sessionId,
      role: role as any,
      content,
      thinking,
      toolName: null,
      toolArgs: null,
      toolCallId: null,
      approvalStatus: null,
      contextStatus: "active",
      tokenCount: null,
      createdAt: new Date().toISOString(),
    };
  }

  private extractRateLimitReset(error: any): string | null {
    // The Vercel AI SDK wraps errors in layers — walk through all possible locations
    for (const obj of [error, error?.cause, error?.lastError, error?.lastError?.cause]) {
      if (obj?.statusCode === 429) {
        const reset = obj?.responseHeaders?.["anthropic-ratelimit-input-tokens-reset"];
        if (reset) return reset;
      }
    }
    return null;
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private shutdown(): void {
    console.log("shutting down...");
    this.shouldReconnect = false;
    this.abortController?.abort();
    this.ws?.close();
    process.exit(0);
  }
}
