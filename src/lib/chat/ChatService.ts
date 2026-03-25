import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chatTable, messageTable, messageUsageTable } from "@/db/schema";
import { Agent } from "@/lib/agent/Agent";
import type { AgentResponse } from "@/lib/agent/types";
import { AppError } from "@/lib/error/AppError";
import type { PersistedMessage } from "@/lib/types";

type CreateChatInput = {
  name: string;
  maxTokens?: number;
  systemMessage?: string;
};

export class ChatService {
  async list() {
    return db
      .select({
        id: chatTable.id,
        name: chatTable.name,
        createdAt: chatTable.createdAt,
      })
      .from(chatTable)
      .orderBy(desc(chatTable.createdAt));
  }

  async create(input: CreateChatInput) {
    const [chat] = await db
      .insert(chatTable)
      .values({
        name: input.name,
        maxTokens: input.maxTokens ?? 4064,
        systemMessage: input.systemMessage ?? "You are a helpful assistant.",
      })
      .returning();
    return chat;
  }

  async getWithMessages(chatId: number) {
    const chat = await db.query.chatTable.findFirst({
      where: eq(chatTable.id, chatId),
      with: {
        messages: {
          orderBy: (msgs, { asc }) => [asc(msgs.createdAt)],
          with: {
            usage: true,
          },
        },
      },
    });

    if (!chat) {
      throw new AppError("Chat not found", 404, "CHAT_NOT_FOUND");
    }

    return chat;
  }

  async rename(chatId: number, name: string) {
    const [updated] = await db
      .update(chatTable)
      .set({ name })
      .where(eq(chatTable.id, chatId))
      .returning();

    if (!updated) {
      throw new AppError("Chat not found", 404, "CHAT_NOT_FOUND");
    }

    return updated;
  }

  async deleteChat(chatId: number) {
    const [deleted] = await db
      .delete(chatTable)
      .where(eq(chatTable.id, chatId))
      .returning();

    if (!deleted) {
      throw new AppError("Chat not found", 404, "CHAT_NOT_FOUND");
    }
  }

  async deleteMessage(chatId: number, messageId: number) {
    const [deleted] = await db
      .delete(messageTable)
      .where(
        and(eq(messageTable.id, messageId), eq(messageTable.chatId, chatId)),
      )
      .returning();

    if (!deleted) {
      throw new AppError("Message not found", 404, "MESSAGE_NOT_FOUND");
    }
  }

  async sendMessage(
    chatId: number,
    content: string,
    overrides?: { model?: string; maxTokens?: number },
  ): Promise<AgentResponse> {
    const chat = await this.getWithMessages(chatId);

    const history: PersistedMessage[] = chat.messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: m.createdAt,
    }));

    const agent = new Agent({
      model: overrides?.model,
      maxTokens: overrides?.maxTokens ?? chat.maxTokens,
      instructions: chat.systemMessage,
    });

    const result = await agent.run(history, content);

    await db.insert(messageTable).values({ chatId, role: "user", content });

    const [assistantMsg] = await db
      .insert(messageTable)
      .values({ chatId, role: "assistant", content: result.content })
      .returning({ id: messageTable.id });

    if (result.usage) {
      await db.insert(messageUsageTable).values({
        messageId: assistantMsg.id,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
        cost: result.usage.cost,
      });
    }

    return result;
  }
}

export const chatService = new ChatService();
