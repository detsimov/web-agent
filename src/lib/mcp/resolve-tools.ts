import { eq } from "drizzle-orm";
import { db } from "@/db";
import { branchMcpOverrideTable, mcpServerTable } from "@/db/schema";
import type { ToolDefinition } from "@/lib/agent/types";
import { ensureAutoConnect, mcpManager } from "./manager";

/** Maps a namespaced tool name back to { serverId, originalToolName } */
export type McpToolRouting = Map<
  string,
  { serverId: number; originalName: string }
>;

export type ResolvedMcpTools = {
  tools: ToolDefinition[];
  routing: McpToolRouting;
};

/**
 * Resolve all MCP tools available for a given branch.
 * Returns tools in OpenRouter/OpenAI function-calling format,
 * plus a routing map for executing calls.
 */
export async function resolveTools(
  branchId: number,
): Promise<ResolvedMcpTools> {
  await ensureAutoConnect();

  const servers = await db.select().from(mcpServerTable);
  const overrides = await db
    .select()
    .from(branchMcpOverrideTable)
    .where(eq(branchMcpOverrideTable.branchId, branchId));

  const overrideMap = new Map(overrides.map((o) => [o.mcpServerId, o.enabled]));

  const tools: ToolDefinition[] = [];
  const routing: McpToolRouting = new Map();

  for (const server of servers) {
    const globalEnabled = !!server.enabled;
    const branchEnabled = overrideMap.has(server.id)
      ? !!overrideMap.get(server.id)
      : globalEnabled;

    if (!branchEnabled) continue;

    const status = mcpManager.getStatus(server.id);
    if (!status || status.status !== "connected") continue;

    const serverTools = mcpManager.getTools(server.id);
    // Namespace: prefix tool names with server name to avoid collisions
    const prefix = server.name.toLowerCase().replace(/[^a-z0-9]/g, "_");

    for (const tool of serverTools) {
      const namespacedName = `${prefix}__${tool.name}`;
      tools.push({
        type: "function",
        function: {
          name: namespacedName,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      });
      routing.set(namespacedName, {
        serverId: server.id,
        originalName: tool.name,
      });
    }
  }

  return { tools, routing };
}
