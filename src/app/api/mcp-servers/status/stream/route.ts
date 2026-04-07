import { db } from "@/db";
import { mcpServerTable } from "@/db/schema";
import { ensureAutoConnect, mcpManager } from "@/lib/mcp/manager";

/**
 * SSE endpoint for real-time MCP server status updates.
 * Sends status snapshots every 2 seconds while connected.
 */
export async function GET() {
  await ensureAutoConnect();

  const encoder = new TextEncoder();
  let closed = false;

  const readable = new ReadableStream({
    async start(controller) {
      async function sendStatus() {
        if (closed) return;
        try {
          const servers = await db
            .select({ id: mcpServerTable.id })
            .from(mcpServerTable);

          const statuses = servers.map((s) => {
            const status = mcpManager.getStatus(s.id);
            return (
              status ?? {
                id: s.id,
                status: "disconnected" as const,
                toolCount: 0,
              }
            );
          });

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ statuses })}\n\n`),
          );
        } catch {
          // Ignore errors during status fetch
        }
      }

      // Send immediately, then every 2s
      await sendStatus();
      const interval = setInterval(sendStatus, 2000);

      // Clean up when client disconnects
      return () => {
        closed = true;
        clearInterval(interval);
      };
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
