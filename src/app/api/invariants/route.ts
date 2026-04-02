import * as z from "zod";
import { AppError } from "@/lib/error/AppError";
import { repo } from "@/lib/repository/DrizzleChatRepository";

export async function GET() {
  try {
    const invariants = await repo.loadInvariants();
    return Response.json({ invariants });
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

const CreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(["regex", "keyword"]).nullable().optional().default(null),
  pattern: z.string().optional().default(""),
  caseSensitive: z.boolean().optional().default(false),
  severity: z.enum(["block", "warn"]),
  promptHint: z.string().min(1),
  enabled: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = CreateSchema.parse(body);
    const invariant = await repo.createInvariant(data);
    return Response.json({ invariant }, { status: 201 });
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
