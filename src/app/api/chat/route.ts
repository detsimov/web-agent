import * as z from "zod";
import { Agent } from "@/lib/agent/Agent";
import { chatService } from "@/lib/chat/ChatService";
import { AppError } from "@/lib/error/AppError";

const ChatRequestSchema = z.object({
  model: z.string().nonempty().optional(),
  maxTokens: z.number().int().positive().max(200000).optional(),
  instructions: z.string().max(4000).optional(),
  chatId: z.number().int().positive().optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().nonempty(),
    }),
  ),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { model, maxTokens, instructions, chatId, messages } =
      ChatRequestSchema.parse(body);

    if (chatId) {
      const lastMessage = messages[messages.length - 1];
      const result = await chatService.sendMessage(
        chatId,
        lastMessage.content,
        {
          model,
          maxTokens,
        },
      );

      return Response.json({
        content: result.content,
        usage: result.usage,
      });
    }

    const agent = new Agent({ model, maxTokens, instructions });
    const result = await agent.runStateless(messages);

    return Response.json({
      content: result.content,
      usage: result.usage,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return Response.json({ error: "Внутренняя ошибка" }, { status: 500 });
  }
}
