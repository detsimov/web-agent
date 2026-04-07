import { eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import { mcpServerTable } from "@/db/schema";
import { mcpManager } from "@/lib/mcp/manager";
import type { McpTransportType } from "@/lib/mcp/types";
import { UpdateMcpServerSchema } from "@/lib/mcp/validation";

type Params = { id: string };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { id } = await params;
    const serverId = Number(id);
    const body = await request.json();
    const data = UpdateMcpServerSchema.parse(body);

    const [existing] = await db
      .select()
      .from(mcpServerTable)
      .where(eq(mcpServerTable.id, serverId));
    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) set.name = data.name;
    if (data.type !== undefined) set.type = data.type;
    if (data.config !== undefined) set.config = JSON.stringify(data.config);
    if (data.enabled !== undefined) set.enabled = data.enabled ? 1 : 0;

    const [updated] = await db
      .update(mcpServerTable)
      .set(set)
      .where(eq(mcpServerTable.id, serverId))
      .returning();

    // Reconnect if config/type changed, or handle enable/disable
    const needsReconnect = data.config !== undefined || data.type !== undefined;
    const wasDisabled = data.enabled === false;
    const wasEnabled = data.enabled === true;

    if (wasDisabled) {
      await mcpManager.disconnect(serverId);
    } else if (wasEnabled || needsReconnect) {
      const config = data.config ?? JSON.parse(existing.config);
      const type = (data.type ?? existing.type) as McpTransportType;
      await mcpManager.connect(serverId, updated.name, type, config);
    }

    const status = mcpManager.getStatus(serverId);
    return Response.json({
      server: {
        ...updated,
        config: JSON.parse(updated.config),
        status: status?.status ?? "disconnected",
        error: status?.error,
        toolCount: status?.toolCount ?? 0,
      },
    });
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
    const serverId = Number(id);

    await mcpManager.disconnect(serverId);
    await db.delete(mcpServerTable).where(eq(mcpServerTable.id, serverId));

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
