import { and, asc, desc, eq, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  branchContextStateTable,
  branchMcpOverrideTable,
  branchTable,
  branchWorkingMemoryTable,
  chatTable,
  globalFactsTable,
  invariantTable,
  machineInstancesTable,
  messageTable,
  messageUsageTable,
  personalizationTable,
} from "@/db/schema";
import type { CommunicationStyleKey } from "@/lib/communication-styles";
import { AppError } from "@/lib/error/AppError";
import type { StateMachineInstance } from "@/lib/machine/types";
import {
  EMPTY_WORKING_MEMORY,
  type TurnResult,
  type WorkingMemory,
} from "@/lib/pipeline/types";
import type { PersistedMessage } from "@/lib/types";
import type {
  BranchRow,
  ChatRow,
  ContextState,
  CreateBranchInput,
  CreateChatInput,
  IChatRepository,
  Invariant,
  Personalization,
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
      Pick<
        ChatRow,
        | "name"
        | "stickyFactsBaseKeys"
        | "stickyFactsRules"
        | "factsExtractionModel"
        | "factsExtractionRules"
      >
    >,
  ): Promise<ChatRow> {
    const set: Record<string, unknown> = {};
    if (data.name !== undefined) set.name = data.name;
    if (data.stickyFactsBaseKeys !== undefined)
      set.stickyFactsBaseKeys = data.stickyFactsBaseKeys;
    if (data.stickyFactsRules !== undefined)
      set.stickyFactsRules = data.stickyFactsRules;
    if (data.factsExtractionModel !== undefined)
      set.factsExtractionModel = data.factsExtractionModel;
    if (data.factsExtractionRules !== undefined)
      set.factsExtractionRules = data.factsExtractionRules;

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
        workingMemoryMode: mainBranch.workingMemoryMode,
        workingMemoryModel: mainBranch.workingMemoryModel,
        workingMemoryEvery: mainBranch.workingMemoryEvery,
        communicationStyle: mainBranch.communicationStyle,
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

    // Copy MCP overrides from parent branch
    const parentOverrides = await db
      .select()
      .from(branchMcpOverrideTable)
      .where(eq(branchMcpOverrideTable.branchId, mainBranch.id));
    if (parentOverrides.length > 0) {
      await db.insert(branchMcpOverrideTable).values(
        parentOverrides.map((o) => ({
          branchId: branch.id,
          mcpServerId: o.mcpServerId,
          enabled: o.enabled,
        })),
      );
    }

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
          cost:
            turn.usage.cost != null && turn.usage.cost > 0
              ? turn.usage.cost
              : null,
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

      // 5. Upsert working memory if changed
      if (turn.workingMemory) {
        await tx
          .insert(branchWorkingMemoryTable)
          .values({
            branchId,
            data: JSON.stringify(turn.workingMemory),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: branchWorkingMemoryTable.branchId,
            set: {
              data: JSON.stringify(turn.workingMemory),
              updatedAt: new Date(),
            },
          });
      }

      return { assistantMessageId: assistantMsg.id };
    });
  }

  // --- Global facts ---

  async loadGlobalFacts(): Promise<Record<string, string>> {
    const rows = await db.select().from(globalFactsTable);
    const facts: Record<string, string> = {};
    for (const row of rows) {
      facts[row.key] = row.value;
    }
    return facts;
  }

  async upsertGlobalFacts(facts: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(facts)) {
      if (value === null || value === undefined) {
        await db.delete(globalFactsTable).where(eq(globalFactsTable.key, key));
      } else {
        await db
          .insert(globalFactsTable)
          .values({ key, value, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: globalFactsTable.key,
            set: { value, updatedAt: new Date() },
          });
      }
    }
  }

  async deleteGlobalFact(key: string): Promise<void> {
    const [deleted] = await db
      .delete(globalFactsTable)
      .where(eq(globalFactsTable.key, key))
      .returning();
    if (!deleted) {
      throw new AppError("Global fact not found", 404, "FACT_NOT_FOUND");
    }
  }

  async listGlobalFacts(): Promise<
    Array<{ key: string; value: string; updatedAt: Date }>
  > {
    const rows = await db
      .select({
        key: globalFactsTable.key,
        value: globalFactsTable.value,
        updatedAt: globalFactsTable.updatedAt,
      })
      .from(globalFactsTable)
      .orderBy(asc(globalFactsTable.key));
    return rows;
  }

  // --- Working memory ---

  async loadWorkingMemory(branchId: number): Promise<WorkingMemory> {
    const row = await db.query.branchWorkingMemoryTable.findFirst({
      where: eq(branchWorkingMemoryTable.branchId, branchId),
    });
    if (!row) return { ...EMPTY_WORKING_MEMORY };
    return JSON.parse(row.data) as WorkingMemory;
  }

  async saveWorkingMemory(
    branchId: number,
    data: WorkingMemory,
  ): Promise<void> {
    await db
      .insert(branchWorkingMemoryTable)
      .values({
        branchId,
        data: JSON.stringify(data),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: branchWorkingMemoryTable.branchId,
        set: {
          data: JSON.stringify(data),
          updatedAt: new Date(),
        },
      });
  }

  // --- Branch facts (for background extraction) ---

  async updateBranchFacts(
    branchId: number,
    facts: Record<string, string>,
  ): Promise<void> {
    const current = await this.loadContextState(branchId);
    const merged = { ...current.facts };
    for (const [key, value] of Object.entries(facts)) {
      if (value === null || value === undefined) {
        delete merged[key];
      } else {
        merged[key] = value;
      }
    }
    await db
      .insert(branchContextStateTable)
      .values({
        branchId,
        facts: JSON.stringify(merged),
        context: current.context,
        summarizedUpTo: current.summarizedUpTo,
        factsExtractedUpTo: current.factsExtractedUpTo,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: branchContextStateTable.branchId,
        set: {
          facts: JSON.stringify(merged),
          updatedAt: new Date(),
        },
      });
  }
  // --- Machine instances ---

  private toMachineInstance(row: {
    id: number;
    branchId: number;
    definitionId: string;
    currentState: string;
    status: string;
    data: string;
    history: string;
    createdAt: Date;
    updatedAt: Date;
  }): StateMachineInstance {
    return {
      id: row.id,
      branchId: row.branchId,
      definitionId: row.definitionId,
      current: row.currentState,
      status: row.status as StateMachineInstance["status"],
      data: JSON.parse(row.data) as Record<string, unknown>,
      history: JSON.parse(row.history) as StateMachineInstance["history"],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async loadMachineInstance(
    branchId: number,
  ): Promise<StateMachineInstance | null> {
    const row = await db.query.machineInstancesTable.findFirst({
      where: and(
        eq(machineInstancesTable.branchId, branchId),
        eq(machineInstancesTable.status, "active"),
      ),
    });
    if (!row) return null;
    return this.toMachineInstance(row);
  }

  async createMachineInstance(
    branchId: number,
    definitionId: string,
    initialState: string,
    data: Record<string, unknown>,
  ): Promise<StateMachineInstance> {
    // Enforce one active instance per branch
    const existing = await this.loadMachineInstance(branchId);
    if (existing) {
      throw new AppError(
        "A machine is already active on this branch",
        409,
        "MACHINE_ALREADY_ACTIVE",
      );
    }

    const [row] = await db
      .insert(machineInstancesTable)
      .values({
        branchId,
        definitionId,
        currentState: initialState,
        status: "active",
        data: JSON.stringify(data),
        history: JSON.stringify([]),
        updatedAt: new Date(),
      })
      .returning();

    return this.toMachineInstance(row);
  }

  async saveMachineInstance(instance: StateMachineInstance): Promise<void> {
    await db
      .update(machineInstancesTable)
      .set({
        currentState: instance.current,
        status: instance.status,
        data: JSON.stringify(instance.data),
        history: JSON.stringify(instance.history),
        updatedAt: new Date(),
      })
      .where(eq(machineInstancesTable.id, instance.id));
  }

  async stopMachineInstance(
    branchId: number,
  ): Promise<StateMachineInstance | null> {
    const instance = await this.loadMachineInstance(branchId);
    if (!instance) return null;

    const [row] = await db
      .update(machineInstancesTable)
      .set({ status: "stopped", updatedAt: new Date() })
      .where(eq(machineInstancesTable.id, instance.id))
      .returning();

    return this.toMachineInstance(row);
  }

  async loadLastCompletedInstance(
    branchId: number,
  ): Promise<StateMachineInstance | null> {
    const rows = await db
      .select()
      .from(machineInstancesTable)
      .where(
        and(
          eq(machineInstancesTable.branchId, branchId),
          ne(machineInstancesTable.status, "active"),
        ),
      )
      .orderBy(desc(machineInstancesTable.updatedAt))
      .limit(1);

    if (rows.length === 0) return null;
    return this.toMachineInstance(rows[0]);
  }

  // --- Personalization (singleton) ---

  async loadPersonalization(): Promise<Personalization> {
    await db
      .insert(personalizationTable)
      .values({ id: 1, communicationStyle: "normal" })
      .onConflictDoNothing();

    const rows = await db
      .select()
      .from(personalizationTable)
      .where(eq(personalizationTable.id, 1));

    return {
      communicationStyle: (rows[0]?.communicationStyle ??
        "normal") as CommunicationStyleKey,
      ollamaBaseUrl: rows[0]?.ollamaBaseUrl ?? null,
    };
  }

  async updatePersonalization(
    data: Partial<Personalization>,
  ): Promise<Personalization> {
    // Ensure the row exists before updating (loadPersonalization handles upsert)
    await this.loadPersonalization();

    await db
      .update(personalizationTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(personalizationTable.id, 1));

    return this.loadPersonalization();
  }

  // --- Invariants ---

  private toInvariant(row: typeof invariantTable.$inferSelect): Invariant {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: (row.type === "" ? null : row.type) as Invariant["type"],
      pattern: row.pattern,
      caseSensitive: row.caseSensitive === 1,
      severity: row.severity as Invariant["severity"],
      promptHint: row.promptHint,
      enabled: row.enabled === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async loadInvariants(filter?: { enabled: boolean }): Promise<Invariant[]> {
    const rows = filter?.enabled
      ? await db
          .select()
          .from(invariantTable)
          .where(eq(invariantTable.enabled, 1))
          .orderBy(asc(invariantTable.createdAt))
      : await db
          .select()
          .from(invariantTable)
          .orderBy(asc(invariantTable.createdAt));

    return rows.map((r) => this.toInvariant(r));
  }

  async createInvariant(
    data: Omit<Invariant, "id" | "createdAt" | "updatedAt">,
  ): Promise<Invariant> {
    const id = crypto.randomUUID();
    const [row] = await db
      .insert(invariantTable)
      .values({
        id,
        name: data.name,
        description: data.description,
        type: data.type ?? "",
        pattern: data.pattern,
        caseSensitive: data.caseSensitive ? 1 : 0,
        severity: data.severity,
        promptHint: data.promptHint,
        enabled: data.enabled ? 1 : 0,
        updatedAt: new Date(),
      })
      .returning();

    return this.toInvariant(row);
  }

  async updateInvariant(
    id: string,
    data: Partial<Omit<Invariant, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Invariant> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) set.name = data.name;
    if (data.description !== undefined) set.description = data.description;
    if (data.type !== undefined) set.type = data.type ?? "";
    if (data.pattern !== undefined) set.pattern = data.pattern;
    if (data.caseSensitive !== undefined)
      set.caseSensitive = data.caseSensitive ? 1 : 0;
    if (data.severity !== undefined) set.severity = data.severity;
    if (data.promptHint !== undefined) set.promptHint = data.promptHint;
    if (data.enabled !== undefined) set.enabled = data.enabled ? 1 : 0;

    const [row] = await db
      .update(invariantTable)
      .set(set)
      .where(eq(invariantTable.id, id))
      .returning();

    if (!row) {
      throw new AppError("Invariant not found", 404, "INVARIANT_NOT_FOUND");
    }
    return this.toInvariant(row);
  }

  async deleteInvariant(id: string): Promise<void> {
    const [deleted] = await db
      .delete(invariantTable)
      .where(eq(invariantTable.id, id))
      .returning();

    if (!deleted) {
      throw new AppError("Invariant not found", 404, "INVARIANT_NOT_FOUND");
    }
  }
}

export const repo = new DrizzleChatRepository();
