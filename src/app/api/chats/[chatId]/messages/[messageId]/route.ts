import { chatService } from "@/lib/chat/ChatService";
import { AppError } from "@/lib/error/AppError";

type Params = { chatId: string; messageId: string };

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { chatId, messageId } = await params;
    await chatService.deleteMessage(Number(chatId), Number(messageId));
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
