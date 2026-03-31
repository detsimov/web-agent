import * as z from "zod";
import { repo } from "@/lib/repository/DrizzleChatRepository";

const PatchSchema = z.object({
  communicationStyle: z
    .enum(["normal", "teaching", "concise", "explanatory", "casual"])
    .optional(),
});

export async function GET() {
  const data = await repo.loadPersonalization();
  return Response.json(data);
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const data = PatchSchema.parse(body);
    const result = await repo.updatePersonalization(data);
    return Response.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
