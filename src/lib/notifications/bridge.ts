import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationBridgeTable, notificationLogTable } from "@/db/schema";
import { formatNotification } from "@/lib/notifications/format";
import { telegramTransport } from "@/lib/notifications/transports/telegram";

export type BridgeTransport = {
  send(message: string, config: Record<string, unknown>): Promise<void>;
};

const transports: Record<string, BridgeTransport> = {
  telegram: telegramTransport,
};

type NotificationContext = {
  type: string;
  serverName: string;
  payload: Record<string, unknown>;
  mcpServerId: number;
};

export async function dispatch(ctx: NotificationContext): Promise<void> {
  const bridges = await db
    .select()
    .from(notificationBridgeTable)
    .where(eq(notificationBridgeTable.enabled, 1));

  for (const bridge of bridges) {
    const transport = transports[bridge.type];
    if (!transport) continue;

    let llmOutput = "";
    try {
      llmOutput = await formatNotification(bridge.llmModel, bridge.llmPrompt, {
        type: ctx.type,
        serverName: ctx.serverName,
        payload: JSON.stringify(ctx.payload),
      });

      const config = JSON.parse(bridge.config) as Record<string, unknown>;
      await transport.send(llmOutput, config);

      await db.insert(notificationLogTable).values({
        bridgeId: bridge.id,
        mcpServerId: ctx.mcpServerId,
        type: ctx.type,
        rawPayload: JSON.stringify(ctx.payload),
        llmOutput,
        status: "sent",
      });
    } catch (error) {
      await db.insert(notificationLogTable).values({
        bridgeId: bridge.id,
        mcpServerId: ctx.mcpServerId,
        type: ctx.type,
        rawPayload: JSON.stringify(ctx.payload),
        llmOutput,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
