import { AppError } from "@/lib/error/AppError";
import { openRouter } from "@/lib/openrouter";
import type { Message } from "@/lib/types";

export type ChatOptions = {
  model: string;
  maxTokens?: number;
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
