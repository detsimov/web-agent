import { eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import { notificationBridgeTable } from "@/db/schema";

type Params = { id: string };

const telegramConfigSchema = z.object({
  botToken: z.string().min(1),
  telegramId: z.string().min(1),
  parseMode: z.enum(["Markdown", "HTML"]).default("Markdown"),
});

const configByType = {
  telegram: telegramConfigSchema,
} as const;

const PatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    type: z.string().min(1).optional(),
    enabled: z.boolean().optional(),
    llmModel: z.string().min(1).optional(),
    llmPrompt: z.string().min(1).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.config && data.type) {
      const schema = configByType[data.type as keyof typeof configByType];
      if (schema) {
        const result = schema.safeParse(data.config);
        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({
              ...issue,
              path: ["config", ...issue.path],
            });
          }
        }
      }
    }
  });

function serializeBridge(row: typeof notificationBridgeTable.$inferSelect) {
  return {
    ...row,
    enabled: row.enabled === 1,
    config: JSON.parse(row.config),
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = PatchSchema.parse(body);

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) set.name = data.name;
    if (data.type !== undefined) set.type = data.type;
    if (data.enabled !== undefined) set.enabled = data.enabled ? 1 : 0;
    if (data.llmModel !== undefined) set.llmModel = data.llmModel;
    if (data.llmPrompt !== undefined) set.llmPrompt = data.llmPrompt;
    if (data.config !== undefined) set.config = JSON.stringify(data.config);

    const [row] = await db
      .update(notificationBridgeTable)
      .set(set)
      .where(eq(notificationBridgeTable.id, Number(id)))
      .returning();

    if (!row) {
      return Response.json({ error: "Bridge not found" }, { status: 404 });
    }

    return Response.json({ bridge: serializeBridge(row) });
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { id } = await params;
    const [deleted] = await db
      .delete(notificationBridgeTable)
      .where(eq(notificationBridgeTable.id, Number(id)))
      .returning();

    if (!deleted) {
      return Response.json({ error: "Bridge not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
