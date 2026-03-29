import { and, asc, desc, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  branchContextStateTable,
  branchTable,
  chatTable,
  messageTable,
  messageUsageTable,
} from "@/db/schema";
import { AppError } from "@/lib/error/AppError";
import type { TurnResult } from "@/lib/pipeline/types";
import type { PersistedMessage } from "@/lib/types";
import type {
  BranchRow,
  ChatRow,
  ContextState,
  CreateBranchInput,
  CreateChatInput,
  IChatRepository,
} from "./types";

function toPersistedMessage(row: {
  id: number;
  role: string;
  content: string;
  createdAt: Date;
}): PersistedMessage {
  return {
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    createdAt: row.createdAt,
  };
}

export class DrizzleChatRepository implements IChatRepository {
  // --- Chats ---

  async listChats(): Promise<ChatRow[]> {
    return db.select().from(chatTable).orderBy(desc(chatTable.createdAt));
  }

  async createChat(input: CreateChatInput) {
    const [chat] = await db
      .insert(chatTable)
      .values({
        name: input.name,
        maxTokens: input.maxTokens ?? 4064,
        systemMessage: input.systemMessage ?? "You are a helpful assistant.",
      })
      .returning();

    const [branch] = await db
      .insert(branchTable)
      .values({
        chatId: chat.id,
        name: "main",
      })
      .returning();

    return { ...chat, mainBranchId: branch.id };
  }

  async getChat(chatId: number): Promise<ChatRow> {
    const chat = await db.query.chatTable.findFirst({
      where: eq(chatTable.id, chatId),
    });
    if (!chat) {
      throw new AppError("Chat not found", 404, "CHAT_NOT_FOUND");
    }
    return chat;
  }

  async updateChat(
    chatId: number,
    data: Partial<
      Pick<ChatRow, "name" | "stickyFactsBaseKeys" | "stickyFactsRules">
    >,
  ): Promise<ChatRow> {
    const set: Record<string, unknown> = {};
    if (data.name !== undefined) set.name = data.name;
    if (data.stickyFactsBaseKeys !== undefined)
      set.stickyFactsBaseKeys = data.stickyFactsBaseKeys;
    if (data.stickyFactsRules !== undefined)
      set.stickyFactsRules = data.stickyFactsRules;

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

  async deleteChat(chatId: number): Promise<void> {
    const [deleted] = await db
      .delete(chatTable)
      .where(eq(chatTable.id, chatId))
      .returning();

    if (!deleted) {
      throw new AppError("Chat not found", 404, "CHAT_NOT_FOUND");
    }
  }

  // --- Branches ---

  async getBranch(branchId: number): Promise<BranchRow> {
    const branch = await db.query.branchTable.findFirst({
      where: eq(branchTable.id, branchId),
    });
    if (!branch) {
      throw new AppError("Branch not found", 404, "BRANCH_NOT_FOUND");
    }
    return branch;
  }

  async getMainBranch(chatId: number): Promise<BranchRow> {
    const branch = await db.query.branchTable.findFirst({
      where: and(eq(branchTable.chatId, chatId), eq(branchTable.name, "main")),
    });
    if (!branch) {
      throw new AppError("Main branch not found", 404, "BRANCH_NOT_FOUND");
    }
    return branch;
  }

  async listBranches(chatId: number): Promise<BranchRow[]> {
    return db
      .select()
      .from(branchTable)
      .where(eq(branchTable.chatId, chatId))
      .orderBy(asc(branchTable.createdAt));
  }

  async createBranch(
    chatId: number,
    input: CreateBranchInput,
  ): Promise<BranchRow> {
    const mainBranch = await this.getMainBranch(chatId);

    const msg = await db.query.messageTable.findFirst({
      where: and(
        eq(messageTable.id, input.forkedAtMsgId),
        eq(messageTable.branchId, mainBranch.id),
      ),
    });
    if (!msg) {
      throw new AppError(
        "Message not found in main branch",
        400,
        "INVALID_FORK_POINT",
      );
    }

    const [branch] = await db
      .insert(branchTable)
      .values({
        chatId,
        name: input.name,
        parentBranchId: mainBranch.id,
        forkedAtMsgId: input.forkedAtMsgId,
        contextMode: mainBranch.contextMode,
        model: mainBranch.model,
        slidingWindowSize: mainBranch.slidingWindowSize,
        stickyFactsEnabled: mainBranch.stickyFactsEnabled,
        stickyFactsEvery: mainBranch.stickyFactsEvery,
        stickyFactsModel: mainBranch.stickyFactsModel,
        summarizationTrigger: mainBranch.summarizationTrigger,
        summarizationModel: mainBranch.summarizationModel,
        summarizationEvery: mainBranch.summarizationEvery,
        summarizationRatio: mainBranch.summarizationRatio,
        summarizationKeep: mainBranch.summarizationKeep,
      })
      .returning();

    // Copy context state from main branch
    const mainState = await this.loadContextState(mainBranch.id);
    await this.saveContextState(
      branch.id,
      mainState.facts,
      mainState.context,
      mainState.summarizedUpTo,
      mainState.factsExtractedUpTo,
    );

    return branch;
  }

  async updateBranch(
    branchId: number,
    data: Partial<Omit<BranchRow, "id" | "chatId" | "createdAt">>,
  ): Promise<BranchRow> {
    const set: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) set[key] = value;
    }

    if (Object.keys(set).length === 0) {
      throw new AppError("No fields to update", 400, "EMPTY_UPDATE");
    }

    const [updated] = await db
      .update(branchTable)
      .set(set)
      .where(eq(branchTable.id, branchId))
      .returning();

    if (!updated) {
      throw new AppError("Branch not found", 404, "BRANCH_NOT_FOUND");
    }
    return updated;
  }

  async deleteBranch(branchId: number): Promise<void> {
    const branch = await this.getBranch(branchId);
    if (!branch.parentBranchId) {
      throw new AppError(
        "Cannot delete main branch",
        400,
        "CANNOT_DELETE_MAIN",
      );
    }
    await db.delete(branchTable).where(eq(branchTable.id, branchId));
  }

  async renameBranch(branchId: number, name: string): Promise<BranchRow> {
    const branch = await this.getBranch(branchId);
    if (!branch.parentBranchId) {
      throw new AppError(
        "Cannot rename main branch",
        400,
        "CANNOT_RENAME_MAIN",
      );
    }

    const [updated] = await db
      .update(branchTable)
      .set({ name })
      .where(eq(branchTable.id, branchId))
      .returning();

    return updated;
  }

  // --- Messages ---

  async resolveMessages(branch: BranchRow): Promise<PersistedMessage[]> {
    if (!branch.parentBranchId) {
      const rows = await db
        .select()
        .from(messageTable)
        .where(eq(messageTable.branchId, branch.id))
        .orderBy(asc(messageTable.createdAt));

      return rows.map(toPersistedMessage);
    }

    const parentMessages = branch.forkedAtMsgId
      ? await db
          .select()
          .from(messageTable)
          .where(
            and(
              eq(messageTable.branchId, branch.parentBranchId),
              lte(messageTable.id, branch.forkedAtMsgId),
            ),
          )
          .orderBy(asc(messageTable.createdAt))
      : [];

    const ownMessages = await db
      .select()
      .from(messageTable)
      .where(eq(messageTable.branchId, branch.id))
      .orderBy(asc(messageTable.createdAt));

    return [
      ...parentMessages.map(toPersistedMessage),
      ...ownMessages.map(toPersistedMessage),
    ];
  }

  async deleteMessage(branchId: number, messageId: number): Promise<void> {
    const [deleted] = await db
      .delete(messageTable)
      .where(
        and(
          eq(messageTable.id, messageId),
          eq(messageTable.branchId, branchId),
        ),
      )
      .returning();

    if (!deleted) {
      throw new AppError("Message not found", 404, "MESSAGE_NOT_FOUND");
    }
  }

  // --- Context state ---

  async loadContextState(branchId: number): Promise<ContextState> {
    const row = await db.query.branchContextStateTable.findFirst({
      where: eq(branchContextStateTable.branchId, branchId),
    });
    if (!row) {
      return {
        facts: {},
        context: "",
        summarizedUpTo: 0,
        factsExtractedUpTo: 0,
      };
    }
    return {
      facts: JSON.parse(row.facts) as Record<string, string>,
      context: row.context,
      summarizedUpTo: row.summarizedUpTo,
      factsExtractedUpTo: row.factsExtractedUpTo,
    };
  }

  private async saveContextState(
    branchId: number,
    facts: Record<string, string>,
    context: string,
    summarizedUpTo: number,
    factsExtractedUpTo: number,
  ) {
    await db
      .insert(branchContextStateTable)
      .values({
        branchId,
        facts: JSON.stringify(facts),
        context,
        summarizedUpTo,
        factsExtractedUpTo,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: branchContextStateTable.branchId,
        set: {
          facts: JSON.stringify(facts),
          context,
          summarizedUpTo,
          factsExtractedUpTo,
          updatedAt: new Date(),
        },
      });
  }

  // --- Usage ---

  async getLastUsage(branchId: number): Promise<{ totalTokens: number }> {
    const row = await db
      .select({ totalTokens: messageUsageTable.totalTokens })
      .from(messageUsageTable)
      .innerJoin(messageTable, eq(messageUsageTable.messageId, messageTable.id))
      .where(eq(messageTable.branchId, branchId))
      .orderBy(desc(messageUsageTable.createdAt))
      .limit(1);

    return row[0] ?? { totalTokens: 0 };
  }

  // --- Full chat with relations ---

  async getChatWithMessages(chatId: number) {
    const chat = await db.query.chatTable.findFirst({
      where: eq(chatTable.id, chatId),
      with: {
        branches: {
          with: {
            messages: {
              orderBy: (msgs, { asc }) => [asc(msgs.createdAt)],
              with: {
                usage: true,
              },
            },
            contextState: true,
          },
        },
      },
    });

    if (!chat) {
      throw new AppError("Chat not found", 404, "CHAT_NOT_FOUND");
    }
    return chat;
  }

  // --- Atomic turn commit ---

  async commitTurn(
    branchId: number,
    turn: TurnResult,
  ): Promise<{ assistantMessageId: number }> {
    return await db.transaction(async (tx) => {
      // 1. Insert user message
      await tx.insert(messageTable).values({
        branchId,
        role: "user",
        content: turn.userContent,
      });

      // 2. Insert assistant message
      const [assistantMsg] = await tx
        .insert(messageTable)
        .values({
          branchId,
          role: "assistant",
          content: turn.assistantContent,
        })
        .returning({ id: messageTable.id });

      // 3. Insert usage if present
      if (turn.usage) {
        await tx.insert(messageUsageTable).values({
          messageId: assistantMsg.id,
          inputTokens: turn.usage.inputTokens,
          outputTokens: turn.usage.outputTokens,
          totalTokens: turn.usage.totalTokens,
          cost: turn.usage.cost > 0 ? turn.usage.cost : null,
        });
      }

      // 4. Upsert context state if changed
      if (turn.contextState) {
        await tx
          .insert(branchContextStateTable)
          .values({
            branchId,
            facts: JSON.stringify(turn.contextState.facts),
            context: turn.contextState.context,
            summarizedUpTo: turn.contextState.summarizedUpTo,
            factsExtractedUpTo: turn.contextState.factsExtractedUpTo,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: branchContextStateTable.branchId,
            set: {
              facts: JSON.stringify(turn.contextState.facts),
              context: turn.contextState.context,
              summarizedUpTo: turn.contextState.summarizedUpTo,
              factsExtractedUpTo: turn.contextState.factsExtractedUpTo,
              updatedAt: new Date(),
            },
          });
      }

      return { assistantMessageId: assistantMsg.id };
    });
  }
}

export const repo = new DrizzleChatRepository();
