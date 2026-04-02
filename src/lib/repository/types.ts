import type { CommunicationStyleKey } from "@/lib/communication-styles";
import type { StateMachineInstance } from "@/lib/machine/types";
import type { TurnResult, WorkingMemory } from "@/lib/pipeline/types";
import type { PersistedMessage } from "@/lib/types";

export type ChatRow = {
  id: number;
  name: string;
  maxTokens: number;
  systemMessage: string;
  stickyFactsBaseKeys: string | null;
  stickyFactsRules: string | null;
  factsExtractionModel: string | null;
  factsExtractionRules: string | null;
  createdAt: Date;
};

export type BranchRow = {
  id: number;
  chatId: number;
  name: string;
  parentBranchId: number | null;
  forkedAtMsgId: number | null;
  contextMode: string;
  model: string | null;
  slidingWindowSize: number;
  stickyFactsEnabled: number;
  stickyFactsEvery: number;
  stickyFactsModel: string | null;
  summarizationTrigger: string | null;
  summarizationModel: string | null;
  summarizationEvery: number | null;
  summarizationRatio: number | null;
  summarizationKeep: number | null;
  workingMemoryMode: string;
  workingMemoryModel: string | null;
  workingMemoryEvery: number;
  communicationStyle: string | null;
  createdAt: Date;
};

export type ContextState = {
  facts: Record<string, string>;
  context: string;
  summarizedUpTo: number;
  factsExtractedUpTo: number;
};

export type Personalization = {
  communicationStyle: CommunicationStyleKey;
};

export type Invariant = {
  id: string;
  name: string;
  description: string;
  type: "regex" | "keyword" | null;
  pattern: string;
  caseSensitive: boolean;
  severity: "block" | "warn";
  promptHint: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateChatInput = {
  name: string;
  maxTokens?: number;
  systemMessage?: string;
};

export type CreateBranchInput = {
  name: string;
  forkedAtMsgId: number;
};

export interface IChatRepository {
  // --- Chats ---
  listChats(): Promise<ChatRow[]>;
  createChat(
    input: CreateChatInput,
  ): Promise<ChatRow & { mainBranchId: number }>;
  getChat(chatId: number): Promise<ChatRow>;
  updateChat(
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
  ): Promise<ChatRow>;
  deleteChat(chatId: number): Promise<void>;

  // --- Branches ---
  getBranch(branchId: number): Promise<BranchRow>;
  getMainBranch(chatId: number): Promise<BranchRow>;
  listBranches(chatId: number): Promise<BranchRow[]>;
  createBranch(chatId: number, input: CreateBranchInput): Promise<BranchRow>;
  updateBranch(
    branchId: number,
    data: Partial<Omit<BranchRow, "id" | "chatId" | "createdAt">>,
  ): Promise<BranchRow>;
  deleteBranch(branchId: number): Promise<void>;
  renameBranch(branchId: number, name: string): Promise<BranchRow>;

  // --- Messages ---
  resolveMessages(branch: BranchRow): Promise<PersistedMessage[]>;
  deleteMessage(branchId: number, messageId: number): Promise<void>;

  // --- Context state ---
  loadContextState(branchId: number): Promise<ContextState>;

  // --- Usage ---
  getLastUsage(branchId: number): Promise<{ totalTokens: number }>;

  // --- Full chat with relations (for UI) ---
  getChatWithMessages(chatId: number): Promise<unknown>;

  // --- Atomic turn commit ---
  commitTurn(
    branchId: number,
    turn: TurnResult,
  ): Promise<{ assistantMessageId: number }>;

  // --- Global facts ---
  loadGlobalFacts(): Promise<Record<string, string>>;
  upsertGlobalFacts(facts: Record<string, string>): Promise<void>;
  deleteGlobalFact(key: string): Promise<void>;
  listGlobalFacts(): Promise<
    Array<{ key: string; value: string; updatedAt: Date }>
  >;

  // --- Working memory ---
  loadWorkingMemory(branchId: number): Promise<WorkingMemory>;
  saveWorkingMemory(branchId: number, data: WorkingMemory): Promise<void>;

  // --- Branch facts (for background extraction) ---
  updateBranchFacts(
    branchId: number,
    facts: Record<string, string>,
  ): Promise<void>;

  // --- Machine instances ---
  loadMachineInstance(branchId: number): Promise<StateMachineInstance | null>;
  createMachineInstance(
    branchId: number,
    definitionId: string,
    initialState: string,
    data: Record<string, unknown>,
  ): Promise<StateMachineInstance>;
  saveMachineInstance(instance: StateMachineInstance): Promise<void>;
  stopMachineInstance(branchId: number): Promise<StateMachineInstance | null>;
  loadLastCompletedInstance(
    branchId: number,
  ): Promise<StateMachineInstance | null>;

  // --- Personalization (singleton) ---
  loadPersonalization(): Promise<Personalization>;
  updatePersonalization(
    data: Partial<Personalization>,
  ): Promise<Personalization>;

  // --- Invariants ---
  loadInvariants(filter?: { enabled: boolean }): Promise<Invariant[]>;
  createInvariant(
    data: Omit<Invariant, "id" | "createdAt" | "updatedAt">,
  ): Promise<Invariant>;
  updateInvariant(
    id: string,
    data: Partial<Omit<Invariant, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Invariant>;
  deleteInvariant(id: string): Promise<void>;
}
