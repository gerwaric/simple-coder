import WebSocket from "ws";
import type { Message } from "@simple-coder/shared";
import type { ServerToAgent } from "@simple-coder/shared";
import { LlmClient } from "./llm.js";

export class AgentConnection {
  private ws: WebSocket | null = null;
  private agentId: string;
  private serverUrl: string;
  private secret: string;
  private llm: LlmClient;
  private currentSessionId: string | null = null;
  private messageHistory: Message[] = [];
  private abortController: AbortController | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = true;

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
        await this.runLlmTurn();
        break;
      }

      case "user:message": {
        console.log(`received user message for session ${msg.message.sessionId}`);
        this.messageHistory.push(msg.message);
        await this.runLlmTurn();
        break;
      }

      case "session:stop": {
        console.log(`session ${msg.sessionId} stopped`);
        this.abortController?.abort();
        this.abortController = null;
        this.currentSessionId = null;
        this.messageHistory = [];
        this.send({ type: "agent:ready" });
        break;
      }

      case "tool:result": {
        // Placeholder — not implemented yet
        break;
      }
    }
  }

  private async runLlmTurn(): Promise<void> {
    if (!this.currentSessionId) return;

    const sessionId = this.currentSessionId;
    this.abortController = new AbortController();

    try {
      const generator = this.llm.chat(this.messageHistory, this.abortController.signal);
      let thinkingComplete = false;
      let fullThinking = "";

      while (true) {
        const { value, done } = await generator.next();

        if (done) {
          // done value is the LlmResult
          const result = value;
          this.send({
            type: "assistant:message:complete",
            sessionId,
            content: result.content,
            thinking: result.thinking,
          });

          // Add to history for multi-turn
          this.messageHistory.push({
            id: "",
            sessionId,
            role: "assistant",
            content: result.content,
            thinking: result.thinking,
            createdAt: new Date().toISOString(),
          });
          break;
        }

        if (value.type === "thinking") {
          fullThinking += value.content;
          this.send({
            type: "thinking:token",
            sessionId,
            token: value.content,
          });
        } else {
          if (!thinkingComplete && fullThinking) {
            thinkingComplete = true;
            this.send({
              type: "thinking:complete",
              sessionId,
              thinking: fullThinking,
            });
          }
          this.send({
            type: "assistant:token",
            sessionId,
            token: value.content,
          });
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("LLM call aborted");
        return;
      }
      console.error("LLM error:", err.message);
    } finally {
      this.abortController = null;
    }
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
