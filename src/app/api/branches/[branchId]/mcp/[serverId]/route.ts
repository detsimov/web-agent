import { and, eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import { branchMcpOverrideTable } from "@/db/schema";

type Params = { branchId: string; serverId: string };

const PatchSchema = z.object({
  enabled: z.boolean(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { branchId: bid, serverId } = await params;
    const branchId = Number(bid);
    const mcpServerId = Number(serverId);
    const body = await request.json();
    const { enabled } = PatchSchema.parse(body);

    if (enabled) {
      // Re-enabling = remove override (revert to global default)
      await db
        .delete(branchMcpOverrideTable)
        .where(
          and(
            eq(branchMcpOverrideTable.branchId, branchId),
            eq(branchMcpOverrideTable.mcpServerId, mcpServerId),
          ),
        );
    } else {
      // Disabling = create/update override
      const existing = await db
        .select()
        .from(branchMcpOverrideTable)
        .where(
          and(
            eq(branchMcpOverrideTable.branchId, branchId),
            eq(branchMcpOverrideTable.mcpServerId, mcpServerId),
          ),
        );

      if (existing.length > 0) {
        await db
          .update(branchMcpOverrideTable)
          .set({ enabled: 0 })
          .where(eq(branchMcpOverrideTable.id, existing[0].id));
      } else {
        await db.insert(branchMcpOverrideTable).values({
          branchId,
          mcpServerId,
          enabled: 0,
        });
      }
    }

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { branchId: bid, serverId } = await params;
    const branchId = Number(bid);
    const mcpServerId = Number(serverId);

    await db
      .delete(branchMcpOverrideTable)
      .where(
        and(
          eq(branchMcpOverrideTable.branchId, branchId),
          eq(branchMcpOverrideTable.mcpServerId, mcpServerId),
        ),
      );

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
