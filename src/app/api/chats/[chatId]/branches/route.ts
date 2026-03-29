import * as z from "zod";
import { AppError } from "@/lib/error/AppError";
import { repo } from "@/lib/repository/DrizzleChatRepository";

type Params = { chatId: string };

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { chatId } = await params;
    const branches = await repo.listBranches(Number(chatId));
    return Response.json({ branches });
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

const CreateBranchSchema = z.object({
  name: z.string().nonempty(),
  forkedAtMsgId: z.number().int().positive(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { chatId } = await params;
    const body = await request.json();
    const data = CreateBranchSchema.parse(body);
    const branch = await repo.createBranch(Number(chatId), data);
    return Response.json({ branch }, { status: 201 });
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
