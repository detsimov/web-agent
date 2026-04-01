import { AppError } from "@/lib/error/AppError";
import { repo } from "@/lib/repository/DrizzleChatRepository";

type Params = { branchId: string };

export async function POST(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { branchId } = await params;
    const instance = await repo.stopMachineInstance(Number(branchId));

    if (!instance) {
      return Response.json(
        {
          error: "No active machine on this branch",
          code: "NO_ACTIVE_MACHINE",
        },
        { status: 404 },
      );
    }

    return Response.json({ instance });
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
