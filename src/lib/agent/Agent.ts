import { chat, chatStream } from "@/lib/chat";
import type { StreamChunk } from "@/lib/pipeline/types";
import type { Message } from "@/lib/types";
import {
  DEFAULT_INSTRUCTIONS,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
} from "./constants";
import type { AgentConfig, AgentResponse } from "./types";

const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export class Agent {
  readonly config: AgentConfig;

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = {
      model: config.model ?? DEFAULT_MODEL,
      maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
      instructions: config.instructions ?? DEFAULT_INSTRUCTIONS,
      tools: config.tools,
    };
  }

  async complete(messages: Message[]): Promise<AgentResponse> {
    const enrichedMessages: Message[] = [
      { role: "system", content: this.config.instructions },
      ...messages,
    ];

    return this.withRetry(() => this.call(enrichedMessages));
  }

  async *stream(messages: Message[]): AsyncGenerator<StreamChunk> {
    // messages already include system message (built by pipeline)
    const eventStream = await this.withRetry(() =>
      chatStream(messages, {
        model: this.config.model,
        maxTokens: this.config.maxTokens,
      }),
    );

    let fullContent = "";

    try {
      for await (const event of eventStream) {
        if (event.type === "response.output_text.delta" && "delta" in event) {
          const delta = event.delta as string;
          fullContent += delta;
          yield { type: "delta", content: delta };
        }
        if (event.type === "response.completed" && "response" in event) {
          const response = event.response as {
            output?: Array<{
              type: string;
              content?: Array<{ type: string; text?: string }>;
            }>;
            usage?: {
              inputTokens: number;
              outputTokens: number;
              totalTokens: number;
              cost?: number | null;
            };
          };

          const message = response.output?.find(
            (item) => item.type === "message",
          );
          const content =
            message && "content" in message
              ? (message.content
                  ?.filter((c) => c.type === "output_text")
                  .map((c) => c.text ?? "")
                  .join("") ?? fullContent)
              : fullContent;

          const usage = response.usage;

          yield {
            type: "done",
            content,
            usage: usage
              ? {
                  inputTokens: usage.inputTokens,
                  outputTokens: usage.outputTokens,
                  totalTokens: usage.totalTokens,
                  cost: usage.cost ?? 0,
                }
              : null,
          };
        }
      }
    } catch (error) {
      yield {
        type: "error",
        error: error instanceof Error ? error.message : "Stream error",
      };
    }
  }

  private async call(messages: Message[]): Promise<AgentResponse> {
    const result = await chat(messages, {
      model: this.config.model,
      maxTokens: this.config.maxTokens,
    });

    return {
      content: result.data,
      usage: result.usage,
    };
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === MAX_RETRIES || !isRetryable(error)) {
          throw error;
        }

        const delay = 1000 * 2 ** attempt + Math.random() * 200;
        await sleep(delay);
      }
    }

    throw lastError;
  }
}

function isRetryable(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    return RETRYABLE_STATUSES.has(error.status as number);
  }
  if (error && typeof error === "object" && "statusCode" in error) {
    return RETRYABLE_STATUSES.has(error.statusCode as number);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
