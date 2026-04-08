import { eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import { notificationBridgeTable } from "@/db/schema";

const telegramConfigSchema = z.object({
  botToken: z.string().min(1),
  telegramId: z.string().min(1),
  parseMode: z.enum(["Markdown", "HTML"]).default("Markdown"),
});

const configByType = {
  telegram: telegramConfigSchema,
} as const;

const CreateSchema = z
  .object({
    name: z.string().min(1),
    type: z.string().min(1),
    enabled: z.boolean().optional().default(true),
    llmModel: z.string().min(1),
    llmPrompt: z.string().min(1),
    config: z.record(z.string(), z.unknown()),
  })
  .superRefine((data, ctx) => {
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
  });

function serializeBridge(row: typeof notificationBridgeTable.$inferSelect) {
  return {
    ...row,
    enabled: row.enabled === 1,
    config: JSON.parse(row.config),
  };
}

export async function GET() {
  try {
    const rows = await db.select().from(notificationBridgeTable);
    return Response.json({ bridges: rows.map(serializeBridge) });
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = CreateSchema.parse(body);

    const existing = await db
      .select({ id: notificationBridgeTable.id })
      .from(notificationBridgeTable)
      .where(eq(notificationBridgeTable.name, data.name))
      .limit(1);

    if (existing.length > 0) {
      return Response.json(
        { error: "Bridge name already exists" },
        { status: 409 },
      );
    }

    const [row] = await db
      .insert(notificationBridgeTable)
      .values({
        name: data.name,
        type: data.type,
        enabled: data.enabled ? 1 : 0,
        llmModel: data.llmModel,
        llmPrompt: data.llmPrompt,
        config: JSON.stringify(data.config),
      })
      .returning();

    return Response.json({ bridge: serializeBridge(row) }, { status: 201 });
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
