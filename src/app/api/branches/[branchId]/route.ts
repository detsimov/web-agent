import * as z from "zod";
import { AppError } from "@/lib/error/AppError";
import { repo } from "@/lib/repository/DrizzleChatRepository";

type Params = { branchId: string };

const PatchSchema = z.object({
  name: z.string().nonempty().optional(),
  contextMode: z.enum(["none", "sliding-window", "summarization"]).optional(),
  model: z.string().nullable().optional(),
  slidingWindowSize: z.number().int().positive().optional(),
  stickyFactsEnabled: z.number().int().min(0).max(1).optional(),
  stickyFactsEvery: z.number().int().positive().optional(),
  stickyFactsModel: z.string().nullable().optional(),
  summarizationTrigger: z.enum(["window", "percentage"]).nullable().optional(),
  summarizationModel: z.string().nullable().optional(),
  summarizationEvery: z.number().int().positive().nullable().optional(),
  summarizationRatio: z.number().min(0).max(1).nullable().optional(),
  summarizationKeep: z.number().int().nonnegative().nullable().optional(),
  workingMemoryMode: z.enum(["off", "tool", "auto"]).optional(),
  workingMemoryModel: z.string().nullable().optional(),
  workingMemoryEvery: z.number().int().positive().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { branchId } = await params;
    const body = await request.json();
    const data = PatchSchema.parse(body);
    const branch = await repo.updateBranch(Number(branchId), data);
    return Response.json({ branch });
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
    const { branchId } = await params;
    await repo.deleteBranch(Number(branchId));
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
