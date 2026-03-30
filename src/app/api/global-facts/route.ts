import * as z from "zod";
import { AppError } from "@/lib/error/AppError";
import { repo } from "@/lib/repository/DrizzleChatRepository";

export async function GET() {
  try {
    const facts = await repo.listGlobalFacts();
    return Response.json({ facts });
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

const PutSchema = z.record(z.string(), z.string().nullable());

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const facts = PutSchema.parse(body);
    await repo.upsertGlobalFacts(facts as Record<string, string>);
    const updated = await repo.listGlobalFacts();
    return Response.json({ facts: updated });
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
