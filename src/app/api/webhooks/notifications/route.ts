import { eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import { mcpServerTable } from "@/db/schema";
import { dispatch } from "@/lib/notifications/bridge";

const WebhookSchema = z.object({
  serverName: z.string().min(1),
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = WebhookSchema.parse(body);

    const [server] = await db
      .select()
      .from(mcpServerTable)
      .where(eq(mcpServerTable.name, data.serverName))
      .limit(1);

    if (!server) {
      return Response.json({ error: "Server not found" }, { status: 404 });
    }

    if (server.enabled === 0) {
      return Response.json({ error: "Server is disabled" }, { status: 403 });
    }

    await dispatch({
      type: data.type,
      serverName: server.name,
      payload: data.payload,
      mcpServerId: server.id,
    });

    return Response.json({ success: true });
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
