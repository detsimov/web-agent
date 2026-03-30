import * as z from "zod";
import { AppError } from "@/lib/error/AppError";
import type { WorkingMemory } from "@/lib/pipeline/types";
import { repo } from "@/lib/repository/DrizzleChatRepository";

type Params = { branchId: string };

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { branchId } = await params;
    const workingMemory = await repo.loadWorkingMemory(Number(branchId));
    return Response.json({ workingMemory });
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

const StepSchema = z.object({
  name: z.string(),
  status: z.enum(["done", "active", "pending"]),
});

const PutSchema = z.object({
  summary: z.string(),
  detail: z.string(),
  steps: z.array(StepSchema).default([]),
  history: z.array(z.string()).default([]),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { branchId } = await params;
    const body = await request.json();
    const data = PutSchema.parse(body) as WorkingMemory;
    await repo.saveWorkingMemory(Number(branchId), data);
    return Response.json({ workingMemory: data });
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
