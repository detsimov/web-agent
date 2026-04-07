import { db } from "@/db";
import { mcpServerTable } from "@/db/schema";
import { ensureAutoConnect, mcpManager } from "@/lib/mcp/manager";

export async function GET() {
  try {
    await ensureAutoConnect();

    // Get all server IDs from DB to include disconnected ones
    const servers = await db
      .select({ id: mcpServerTable.id })
      .from(mcpServerTable);

    const statuses = servers.map((s) => {
      const status = mcpManager.getStatus(s.id);
      return (
        status ?? { id: s.id, status: "disconnected" as const, toolCount: 0 }
      );
    });

    return Response.json({ statuses });
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
