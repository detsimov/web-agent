import type { BridgeTransport } from "@/lib/notifications/bridge";

type TelegramConfig = {
  botToken: string;
  telegramId: string;
  parseMode: string;
};

export const telegramTransport: BridgeTransport = {
  async send(message: string, config: Record<string, unknown>) {
    const { botToken, telegramId, parseMode } = config as TelegramConfig;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: parseMode,
      }),
    });

    const body = await response.json();

    if (!body.ok) {
      throw new Error(
        body.description ?? `Telegram API error: ${response.status}`,
      );
    }
  },
};
