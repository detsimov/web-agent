import { AppError } from "@/lib/error/AppError";
import { repo } from "@/lib/repository/DrizzleChatRepository";

type Params = { chatId: string; messageId: string };

export async function DELETE(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { chatId, messageId } = await params;
    const url = new URL(request.url);
    const branchIdParam = url.searchParams.get("branchId");

    let branchId: number;
    if (branchIdParam) {
      branchId = Number(branchIdParam);
    } else {
      const mainBranch = await repo.getMainBranch(Number(chatId));
      branchId = mainBranch.id;
    }

    await repo.deleteMessage(branchId, Number(messageId));
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
