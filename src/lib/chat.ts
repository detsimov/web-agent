import { AppError } from "@/lib/error/AppError";
import { openRouter } from "@/lib/openrouter";
import type { Message } from "@/lib/types";

export type ChatOptions = {
  model: string;
  maxTokens?: number;
};

export type ChatCompletion = {
  data: string;
  usage: ChatGenerationTokenUsage | null;
};

export type ChatGenerationTokenUsage = {
  completionTokens: number;
  promptTokens: number;
  totalTokens: number;
};

export async function chat(
  messages: Message[],
  options: ChatOptions,
): Promise<ChatCompletion> {
  const response = await openRouter.chat.send({
    chatGenerationParams: {
      messages,
      model: options.model,
      maxTokens: options.maxTokens,
      provider: {
        sort: "price",
      },
      stream: false,
    },
  });

  const usage = response.usage;
  const reply = response.choices[0].message.content;

  if (!reply) {
    throw new AppError("Пустой ответ от модели", 502, "EMPTY_RESPONSE");
  }

  return {
    data: reply,
    usage: usage
      ? {
          completionTokens: usage.completionTokens,
          promptTokens: usage.promptTokens,
          totalTokens: usage.totalTokens,
        }
      : null,
  };
}
