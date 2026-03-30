import type { ToolDefinition } from "@/lib/agent/types";
import { AppError } from "@/lib/error/AppError";
import { openRouter } from "@/lib/openrouter";
import type { Message } from "@/lib/types";

export type ChatOptions = {
  model: string;
  maxTokens?: number;
  tools?: ToolDefinition[];
};

export type ChatCompletion = {
  data: string;
  usage: ChatUsage | null;
};

export type ChatUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number | null;
};

function toApiTools(tools?: ToolDefinition[]):
  | Array<{
      type: "function";
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>
  | undefined {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: "function" as const,
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
  }));
}

export async function chat(
  messages: Message[],
  options: ChatOptions,
): Promise<ChatCompletion> {
  const systemMessage = messages.find((m) => m.role === "system");
  const input = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const response = await openRouter.beta.responses.send({
    openResponsesRequest: {
      input,
      instructions: systemMessage?.content,
      model: options.model,
      maxOutputTokens: options.maxTokens,
      tools: toApiTools(options.tools),
      provider: {
        sort: "price",
      },
      stream: false,
    },
  });

  const message = response.output.find((item) => item.type === "message");
  const reply =
    message && "content" in message
      ? message.content
          .filter((c) => c.type === "output_text")
          .map((c) => ("text" in c ? c.text : ""))
          .join("")
      : undefined;

  if (!reply) {
    throw new AppError("Пустой ответ от модели", 502, "EMPTY_RESPONSE");
  }

  const usage = response.usage;

  return {
    data: reply,
    usage: usage
      ? {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
          cost: usage.cost ?? null,
        }
      : null,
  };
}

export function chatStream(messages: Message[], options: ChatOptions) {
  const systemMessage = messages.find((m) => m.role === "system");
  const input = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  return openRouter.beta.responses.send({
    openResponsesRequest: {
      input,
      instructions: systemMessage?.content,
      model: options.model,
      maxOutputTokens: options.maxTokens,
      tools: toApiTools(options.tools),
      provider: {
        sort: "price",
      },
      stream: true,
    },
  });
}

/**
 * Stream with raw input items — supports function_call and function_call_output
 * entries needed for the agentic tool-calling loop.
 */
export function chatStreamWithInput(
  input: Array<Record<string, unknown>>,
  options: ChatOptions & { instructions?: string },
) {
  return openRouter.beta.responses.send({
    openResponsesRequest: {
      // Cast: input contains mixed message and function_call/function_call_output items
      // that the SDK union type can't express from Record<string, unknown>
      input: input as Parameters<
        typeof openRouter.beta.responses.send
      >[0]["openResponsesRequest"]["input"],
      instructions: options.instructions,
      model: options.model,
      maxOutputTokens: options.maxTokens,
      tools: toApiTools(options.tools),
      provider: {
        sort: "price",
      },
      stream: true,
    },
  });
}
