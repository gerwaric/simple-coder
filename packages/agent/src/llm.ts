import { streamText, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { Message } from "@simple-coder/shared";

const SYSTEM_PROMPT = "You are a helpful coding assistant.";

export interface LlmChunk {
  type: "thinking" | "text";
  content: string;
}

export interface LlmResult {
  content: string;
  thinking: string | null;
}

export class LlmClient {
  private model: LanguageModel;
  private provider: string;

  constructor() {
    this.provider = process.env.LLM_PROVIDER || "anthropic";
    const modelId = process.env.LLM_MODEL || "claude-sonnet-4-20250514";

    switch (this.provider) {
      case "anthropic": {
        const anthropic = createAnthropic({
          apiKey: process.env.LLM_API_KEY,
        });
        this.model = anthropic(modelId);
        break;
      }
      case "openai": {
        const openai = createOpenAI({
          apiKey: process.env.LLM_API_KEY,
        });
        this.model = openai(modelId);
        break;
      }
      case "openai-compatible": {
        const openai = createOpenAI({
          apiKey: process.env.LLM_API_KEY || "no-key",
          baseURL: process.env.LLM_BASE_URL,
        });
        this.model = openai(modelId);
        break;
      }
      default:
        throw new Error(`Unknown LLM_PROVIDER: ${provider}`);
    }
  }

  async *chat(
    messages: Message[],
    signal?: AbortSignal,
  ): AsyncGenerator<LlmChunk, LlmResult> {
    const thinkingBudget = Number(process.env.LLM_THINKING_BUDGET) || 10000;

    const result = streamText({
      model: this.model,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      abortSignal: signal,
      providerOptions:
        this.provider === "anthropic"
          ? { anthropic: { thinking: { type: "enabled", budgetTokens: thinkingBudget } } }
          : undefined,
    });

    let fullThinking = "";
    let fullContent = "";

    for await (const part of (await result).fullStream) {
      if (part.type === "reasoning") {
        fullThinking += part.textDelta;
        yield { type: "thinking", content: part.textDelta };
      } else if (part.type === "text-delta") {
        fullContent += part.textDelta;
        yield { type: "text", content: part.textDelta };
      }
    }

    return {
      content: fullContent,
      thinking: fullThinking || null,
    };
  }
}
