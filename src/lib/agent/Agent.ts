import {
  chat,
  chatStream,
  chatStreamWithInput,
  isOllamaModel,
} from "@/lib/chat";
import type {
  StreamChunk,
  ToolCall,
  UsageAccumulator,
} from "@/lib/pipeline/types";
import type { Message } from "@/lib/types";
import {
  DEFAULT_INSTRUCTIONS,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
} from "./constants";
import type { AgentConfig, AgentResponse } from "./types";

const MAX_RETRIES = 3;
const MAX_TOOL_ITERATIONS = 10;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export type ToolHandlerResult = {
  output: unknown;
  streamChunks?: StreamChunk[];
};

export type ToolHandler = (call: ToolCall) => Promise<ToolHandlerResult>;

export class Agent {
  readonly config: AgentConfig;
  private readonly toolHandler?: ToolHandler;

  constructor(config: Partial<AgentConfig> = {}, toolHandler?: ToolHandler) {
    this.config = {
      model: config.model ?? DEFAULT_MODEL,
      maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
      instructions: config.instructions ?? DEFAULT_INSTRUCTIONS,
      tools: config.tools,
    };
    this.toolHandler = toolHandler;
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
    const hasTools = this.config.tools?.length && this.toolHandler;

    if (!hasTools) {
      yield* this.streamSimple(messages);
      return;
    }

    yield* this.streamWithTools(messages);
  }

  private async *streamSimple(
    messages: Message[],
  ): AsyncGenerator<StreamChunk> {
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
          const { content, usage } = extractCompletedResponse(
            event.response,
            fullContent,
          );
          if (usage && isOllamaModel(this.config.model)) usage.cost = null;
          yield { type: "done", content, usage };
        }
      }
    } catch (error) {
      yield {
        type: "error",
        error: error instanceof Error ? error.message : "Stream error",
      };
    }
  }

  private async *streamWithTools(
    messages: Message[],
  ): AsyncGenerator<StreamChunk> {
    const systemMessage = messages.find((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");
    const instructions = systemMessage?.content ?? "";

    // Raw input items — supports function_call and function_call_output entries
    const input: Array<Record<string, unknown>> = nonSystemMessages.map(
      (m) => ({
        role: m.role,
        content: m.content,
      }),
    );

    let totalContent = "";
    let totalUsage: UsageAccumulator | null = null;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const eventStream = await this.withRetry(() =>
        chatStreamWithInput(input, {
          instructions,
          model: this.config.model,
          maxTokens: this.config.maxTokens,
          tools: this.config.tools,
        }),
      );

      const functionCalls: Array<{
        type: "function_call";
        callId: string;
        name: string;
        arguments: string;
      }> = [];
      let hasToolCalls = false;

      try {
        for await (const event of eventStream) {
          if (event.type === "response.output_text.delta" && "delta" in event) {
            const delta = event.delta as string;
            totalContent += delta;
            yield { type: "delta", content: delta };
          }
          if (event.type === "response.completed" && "response" in event) {
            const response = event.response as {
              output?: Array<Record<string, unknown>>;
              usage?: {
                inputTokens: number;
                outputTokens: number;
                totalTokens: number;
                cost?: number | null;
              };
            };

            // Extract function calls from output
            if (response.output) {
              for (const item of response.output) {
                if (item.type === "function_call") {
                  functionCalls.push({
                    type: "function_call",
                    callId: item.callId as string,
                    name: item.name as string,
                    arguments: item.arguments as string,
                  });
                }
              }
            }

            hasToolCalls = functionCalls.length > 0;

            if (response.usage) {
              const iterUsage: UsageAccumulator = {
                inputTokens: response.usage.inputTokens,
                outputTokens: response.usage.outputTokens,
                totalTokens: response.usage.totalTokens,
                cost: response.usage.cost ?? 0,
              };
              totalUsage = totalUsage
                ? {
                    inputTokens: totalUsage.inputTokens + iterUsage.inputTokens,
                    outputTokens:
                      totalUsage.outputTokens + iterUsage.outputTokens,
                    totalTokens: totalUsage.totalTokens + iterUsage.totalTokens,
                    cost: (totalUsage.cost ?? 0) + (iterUsage.cost ?? 0),
                  }
                : iterUsage;
            }

            if (!hasToolCalls) {
              const { content } = extractCompletedResponse(
                event.response,
                totalContent,
              );
              if (totalUsage && isOllamaModel(this.config.model)) {
                totalUsage.cost = null;
              }
              yield { type: "done", content, usage: totalUsage };
            }
          }
        }
      } catch (error) {
        yield {
          type: "error",
          error: error instanceof Error ? error.message : "Stream error",
        };
        return;
      }

      if (!hasToolCalls) break;

      // Process tool calls and append results as raw input items
      for (const fc of functionCalls) {
        const toolCall: ToolCall = {
          id: fc.callId,
          function: {
            name: fc.name,
            arguments: fc.arguments,
          },
        };

        let handlerResult: ToolHandlerResult;
        try {
          handlerResult = (await this.toolHandler?.(toolCall)) ?? {
            output: null,
          };
        } catch (error) {
          handlerResult = {
            output: {
              error:
                error instanceof Error
                  ? error.message
                  : "Tool execution failed",
            },
          };
        }

        const output = handlerResult.output;

        // Append raw function_call + function_call_output items
        // chatStreamWithInput passes these directly to the API
        input.push({
          type: "function_call",
          callId: fc.callId,
          name: fc.name,
          arguments: fc.arguments,
        });
        input.push({
          type: "function_call_output",
          callId: fc.callId,
          output: typeof output === "string" ? output : JSON.stringify(output),
        });

        // Yield any side-effect stream chunks from the tool handler
        if (handlerResult.streamChunks) {
          for (const chunk of handlerResult.streamChunks) {
            yield chunk;
          }
        }
      }
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

function extractCompletedResponse(
  response: unknown,
  fallbackContent: string,
): { content: string; usage: UsageAccumulator | null } {
  const resp = response as {
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

  const message = resp.output?.find((item) => item.type === "message");
  const content =
    message && "content" in message
      ? (message.content
          ?.filter((c) => c.type === "output_text")
          .map((c) => c.text ?? "")
          .join("") ?? fallbackContent)
      : fallbackContent;

  const usage = resp.usage;

  return {
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
