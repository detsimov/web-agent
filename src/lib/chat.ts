import type { OpenRouter } from "@openrouter/sdk";
import type { ToolDefinition } from "@/lib/agent/types";
import { AppError } from "@/lib/error/AppError";
import {
  getOllamaBaseUrl,
  getOllamaBaseUrlOrDefault,
  getOllamaClient,
} from "@/lib/ollama";
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

export const OLLAMA_PREFIX = "ollama/";

export function isOllamaModel(model: string): boolean {
  return model.startsWith(OLLAMA_PREFIX);
}

type ResolvedTransport = {
  client: OpenRouter;
  modelForApi: string;
  isLocal: boolean;
};

async function resolveTransport(model: string): Promise<ResolvedTransport> {
  if (isOllamaModel(model)) {
    const baseUrl = getOllamaBaseUrlOrDefault(await getOllamaBaseUrl());
    return {
      client: getOllamaClient(baseUrl),
      modelForApi: model.slice(OLLAMA_PREFIX.length),
      isLocal: true,
    };
  }
  return {
    client: openRouter,
    modelForApi: model,
    isLocal: false,
  };
}

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

  const { client, modelForApi, isLocal } = await resolveTransport(
    options.model,
  );

  const response = await client.beta.responses.send({
    responsesRequest: {
      input,
      instructions: systemMessage?.content,
      model: modelForApi,
      maxOutputTokens: options.maxTokens,
      tools: toApiTools(options.tools),
      ...(isLocal ? {} : { provider: { sort: "price" as const } }),
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
          cost: isLocal ? null : (usage.cost ?? null),
        }
      : null,
  };
}

export async function chatStream(messages: Message[], options: ChatOptions) {
  const systemMessage = messages.find((m) => m.role === "system");
  const input = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const { client, modelForApi, isLocal } = await resolveTransport(
    options.model,
  );

  return client.beta.responses.send({
    responsesRequest: {
      input,
      instructions: systemMessage?.content,
      model: modelForApi,
      maxOutputTokens: options.maxTokens,
      tools: toApiTools(options.tools),
      ...(isLocal ? {} : { provider: { sort: "price" as const } }),
      stream: true,
    },
  });
}

type ResponsesRequestInput = Extract<
  Parameters<typeof openRouter.beta.responses.send>[0],
  { responsesRequest: { stream: true } }
>["responsesRequest"]["input"];

/**
 * Stream with raw input items — supports function_call and function_call_output
 * entries needed for the agentic tool-calling loop.
 */
export async function chatStreamWithInput(
  input: Array<Record<string, unknown>>,
  options: ChatOptions & { instructions?: string },
) {
  const { client, modelForApi, isLocal } = await resolveTransport(
    options.model,
  );

  return client.beta.responses.send({
    responsesRequest: {
      // Cast: input contains mixed message and function_call/function_call_output items
      // that the SDK union type can't express from Record<string, unknown>
      input: input as ResponsesRequestInput,
      instructions: options.instructions,
      model: modelForApi,
      maxOutputTokens: options.maxTokens,
      tools: toApiTools(options.tools),
      ...(isLocal ? {} : { provider: { sort: "price" as const } }),
      stream: true,
    },
  });
}
