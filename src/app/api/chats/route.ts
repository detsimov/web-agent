import * as z from "zod";
import { chatService } from "@/lib/chat/ChatService";
import { AppError } from "@/lib/error/AppError";

export async function GET() {
  try {
    const chats = await chatService.list();
    return Response.json({ chats });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

const CreateChatSchema = z.object({
  name: z.string().nonempty(),
  maxTokens: z.number().int().positive().optional(),
  systemMessage: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = CreateChatSchema.parse(body);
    const chat = await chatService.create(data);

    return Response.json({ chat }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
