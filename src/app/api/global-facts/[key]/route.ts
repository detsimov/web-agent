import { AppError } from "@/lib/error/AppError";
import { repo } from "@/lib/repository/DrizzleChatRepository";

type Params = { key: string };

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { key } = await params;
    await repo.deleteGlobalFact(decodeURIComponent(key));
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
