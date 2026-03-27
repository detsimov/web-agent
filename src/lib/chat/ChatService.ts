import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  chatTable,
  messageTable,
  messageUsageTable,
  summarizationStateTable,
} from "@/db/schema";
import { Agent } from "@/lib/agent/Agent";
import type { AgentResponse } from "@/lib/agent/types";
import { ContextManager } from "@/lib/context/ContextManager";
import { SUMMARY_SYSTEM_PROMPT } from "@/lib/context/constants";
import type { ContextSummarizationOptions } from "@/lib/context/types";
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

  async updateChat(
    chatId: number,
    data: {
      name?: string;
      summarizationStrategy?: string | null;
      summarizationModel?: string | null;
      summarizationEvery?: number | null;
      summarizationRatio?: number | null;
      summarizationKeep?: number | null;
    },
  ) {
    const set: Record<string, unknown> = {};
    if (data.name !== undefined) set.name = data.name;
    if (data.summarizationStrategy !== undefined)
      set.summarizationStrategy = data.summarizationStrategy;
    if (data.summarizationModel !== undefined)
      set.summarizationModel = data.summarizationModel;
    if (data.summarizationEvery !== undefined)
      set.summarizationEvery = data.summarizationEvery;
    if (data.summarizationRatio !== undefined)
      set.summarizationRatio = data.summarizationRatio;
    if (data.summarizationKeep !== undefined)
      set.summarizationKeep = data.summarizationKeep;

    if (Object.keys(set).length === 0) {
      throw new AppError("No fields to update", 400, "EMPTY_UPDATE");
    }

    const [updated] = await db
      .update(chatTable)
      .set(set)
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

  async loadSummaryState(chatId: number) {
    const row = await db.query.summarizationStateTable.findFirst({
      where: eq(summarizationStateTable.chatId, chatId),
    });
    if (!row) {
      return { core: [] as string[], context: "", summarizedUpTo: 0 };
    }
    return {
      core: JSON.parse(row.core) as string[],
      context: row.context,
      summarizedUpTo: row.summarizedUpTo,
    };
  }

  async saveSummaryState(
    chatId: number,
    core: string[],
    context: string,
    summarizedUpTo: number,
  ) {
    await db
      .insert(summarizationStateTable)
      .values({
        chatId,
        core: JSON.stringify(core),
        context,
        summarizedUpTo,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: summarizationStateTable.chatId,
        set: {
          core: JSON.stringify(core),
          context,
          summarizedUpTo,
          updatedAt: new Date(),
        },
      });
  }

  async getLastUsage(chatId: number) {
    const row = await db
      .select({ totalTokens: messageUsageTable.totalTokens })
      .from(messageUsageTable)
      .innerJoin(messageTable, eq(messageUsageTable.messageId, messageTable.id))
      .where(eq(messageTable.chatId, chatId))
      .orderBy(desc(messageUsageTable.createdAt))
      .limit(1);

    return row[0] ?? { totalTokens: 0 };
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

    let messagesToSend = history;
    let core: string[] | undefined;
    let context: string | undefined;
    let summaryDirty = false;
    let newSummarizedUpTo = 0;

    if (chat.summarizationStrategy) {
      const summaryState = await this.loadSummaryState(chatId);
      const lastUsage = await this.getLastUsage(chatId);

      const options: ContextSummarizationOptions =
        chat.summarizationStrategy === "percentage"
          ? {
              strategy: "percentage",
              ratio: chat.summarizationRatio ?? 0.75,
              keep: chat.summarizationKeep ?? 4,
            }
          : {
              strategy: "window",
              every: chat.summarizationEvery ?? 10,
              keep: chat.summarizationKeep ?? 4,
            };

      const summarizationAgent = new Agent({
        model: chat.summarizationModel ?? undefined,
        instructions: SUMMARY_SYSTEM_PROMPT,
      });

      const contextManager = new ContextManager(options, summarizationAgent);

      const prepareResult = await contextManager.prepare({
        messages: history,
        core: summaryState.core,
        context: summaryState.context,
        summarizedUpTo: summaryState.summarizedUpTo,
        lastUsage: {
          totalTokens: lastUsage.totalTokens,
          maxTokens: overrides?.maxTokens ?? chat.maxTokens,
        },
      });

      messagesToSend = prepareResult.messages;
      core = prepareResult.core;
      context = prepareResult.context;
      summaryDirty = prepareResult.dirty;
      newSummarizedUpTo = prepareResult.summarizedUpTo;
    }

    const agent = new Agent({
      model: overrides?.model,
      maxTokens: overrides?.maxTokens ?? chat.maxTokens,
      instructions: chat.systemMessage,
    });

    const result = await agent.run(messagesToSend, content, core, context);

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

    if (summaryDirty && core && context) {
      await this.saveSummaryState(chatId, core, context, newSummarizedUpTo);
    }

    return result;
  }
}

export const chatService = new ChatService();
