import * as z from "zod";
import { chatService } from "@/lib/chat/ChatService";
import { AppError } from "@/lib/error/AppError";

type Params = { chatId: string };

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { chatId } = await params;
    const chat = await chatService.getWithMessages(Number(chatId));
    return Response.json({ chat });
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

const RenameSchema = z.object({
  name: z.string().nonempty(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { chatId } = await params;
    const body = await request.json();
    const { name } = RenameSchema.parse(body);
    const chat = await chatService.rename(Number(chatId), name);

    return Response.json({ chat });
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { chatId } = await params;
    await chatService.deleteChat(Number(chatId));
    return Response.json({ success: true });
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
