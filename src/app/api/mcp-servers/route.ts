import { eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import { mcpServerTable } from "@/db/schema";
import { AppError } from "@/lib/error/AppError";
import { ensureAutoConnect, mcpManager } from "@/lib/mcp/manager";
import type { McpTransportType } from "@/lib/mcp/types";
import { CreateMcpServerSchema } from "@/lib/mcp/validation";

export async function GET() {
  try {
    await ensureAutoConnect();
    const servers = await db.select().from(mcpServerTable);
    const statuses = mcpManager.getAllStatuses();
    const statusMap = new Map(statuses.map((s) => [s.id, s]));

    const result = servers.map((s) => ({
      ...s,
      config: JSON.parse(s.config),
      status: statusMap.get(s.id)?.status ?? "disconnected",
      error: statusMap.get(s.id)?.error,
      toolCount: statusMap.get(s.id)?.toolCount ?? 0,
      tools: mcpManager.getTools(s.id),
    }));

    return Response.json({ servers: result });
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = CreateMcpServerSchema.parse(body);

    // Check for duplicate name
    const existing = await db
      .select()
      .from(mcpServerTable)
      .where(eq(mcpServerTable.name, data.name));
    if (existing.length > 0) {
      return Response.json(
        { error: "Server name already exists", code: "DUPLICATE_NAME" },
        { status: 409 },
      );
    }

    const [server] = await db
      .insert(mcpServerTable)
      .values({
        name: data.name,
        type: data.type,
        config: JSON.stringify(data.config),
        enabled: data.enabled === false ? 0 : 1,
      })
      .returning();

    // Auto-connect if enabled
    if (server.enabled) {
      await mcpManager.connect(
        server.id,
        server.name,
        server.type as McpTransportType,
        data.config as Record<string, unknown>,
      );
    }

    const status = mcpManager.getStatus(server.id);

    return Response.json(
      {
        server: {
          ...server,
          config: data.config,
          status: status?.status ?? "disconnected",
          error: status?.error,
          toolCount: status?.toolCount ?? 0,
          tools: mcpManager.getTools(server.id),
        },
      },
      { status: 201 },
    );
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
