import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mcpServerTable } from "@/db/schema";
import { mcpManager } from "@/lib/mcp/manager";
import type { McpTransportType } from "@/lib/mcp/types";

type Params = { id: string };

export async function POST(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { id } = await params;
    const serverId = Number(id);

    const [server] = await db
      .select()
      .from(mcpServerTable)
      .where(eq(mcpServerTable.id, serverId));
    if (!server) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    await mcpManager.connect(
      server.id,
      server.name,
      server.type as McpTransportType,
      JSON.parse(server.config),
    );

    const status = mcpManager.getStatus(serverId);
    return Response.json({
      status: status?.status ?? "disconnected",
      error: status?.error,
      toolCount: status?.toolCount ?? 0,
    });
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
