import { eq } from "drizzle-orm";
import { db } from "@/db";
import { branchMcpOverrideTable, mcpServerTable } from "@/db/schema";
import { ensureAutoConnect, mcpManager } from "@/lib/mcp/manager";

type Params = { branchId: string };

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    await ensureAutoConnect();
    const { branchId: bid } = await params;
    const branchId = Number(bid);

    const servers = await db.select().from(mcpServerTable);
    const overrides = await db
      .select()
      .from(branchMcpOverrideTable)
      .where(eq(branchMcpOverrideTable.branchId, branchId));

    const overrideMap = new Map(
      overrides.map((o) => [o.mcpServerId, o.enabled]),
    );

    const result = servers.map((s) => {
      const hasOverride = overrideMap.has(s.id);
      const globalEnabled = !!s.enabled;
      const branchEnabled = hasOverride
        ? !!overrideMap.get(s.id)
        : globalEnabled;
      const status = mcpManager.getStatus(s.id);

      return {
        id: s.id,
        name: s.name,
        type: s.type,
        status: status?.status ?? "disconnected",
        globalEnabled,
        branchEnabled,
        hasOverride,
        toolCount: status?.toolCount ?? 0,
      };
    });

    return Response.json({ servers: result });
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
