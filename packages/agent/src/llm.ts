import { streamText, type LanguageModel, type CoreMessage, type StreamTextResult } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

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
        throw new Error(`Unknown LLM_PROVIDER: ${this.provider}`);
    }
  }

  streamWithTools(opts: {
    system: string;
    messages: CoreMessage[];
    tools: Record<string, any>;
    signal?: AbortSignal;
  }): StreamTextResult<any, any> {
    const thinkingBudget = Number(process.env.LLM_THINKING_BUDGET) || 10000;

    return streamText({
      model: this.model,
      system: opts.system,
      messages: opts.messages,
      tools: opts.tools,
      abortSignal: opts.signal,
      maxSteps: 1, // We handle the loop ourselves
      providerOptions:
        this.provider === "anthropic"
          ? { anthropic: { thinking: { type: "enabled", budgetTokens: thinkingBudget } } }
          : undefined,
    });
  }
}
