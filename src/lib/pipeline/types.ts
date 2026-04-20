import type { CommunicationStyleKey } from "@/lib/communication-styles";
import type { StateMachineInstance } from "@/lib/machine/types";
import type { PinnedTerm } from "@/lib/rag/types";
import type { PersistedMessage } from "@/lib/types";

// --- Working Memory ---

export type WorkingMemoryStep = {
  name: string;
  status: "done" | "active" | "pending";
};

export type WorkingMemory = {
  summary: string;
  detail: string;
  steps: WorkingMemoryStep[];
  history: string[];
  pinned?: PinnedTerm[];
};

export const EMPTY_WORKING_MEMORY: WorkingMemory = {
  summary: "",
  detail: "",
  steps: [],
  history: [],
};

// --- Tool Calling ---

export type ToolCall = {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
};

// --- Pipeline ---

export type PipelineState = {
  messages: PersistedMessage[];
  facts: Record<string, string>;
  globalFacts: Record<string, string>;
  context: string;
  workingMemory: WorkingMemory;
  cursors: {
    summarizedUpTo: number;
    factsExtractedUpTo: number;
  };
  usage: UsageAccumulator;
};

export type BranchConfig = {
  contextMode: "none" | "sliding-window" | "summarization";
  slidingWindowSize: number;
  summarizationTrigger: "window" | "percentage";
  summarizationEvery: number;
  summarizationRatio: number;
  summarizationKeep: number;
  summarizationModel: string | null;
  stickyFactsEnabled: boolean;
  stickyFactsEvery: number;
  stickyFactsModel: string | null;
  stickyFactsBaseKeys: string[];
  stickyFactsRules: string;
  workingMemoryMode: "off" | "tool" | "auto";
  workingMemoryModel: string | null;
  workingMemoryEvery: number;
  factsExtractionModel: string | null;
  factsExtractionRules: string;
  communicationStyle: CommunicationStyleKey;
  lastTotalTokens: number;
  maxTokens: number;
};

export type UsageAccumulator = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
};

export type TurnResult = {
  userContent: string;
  assistantContent: string;
  usage: UsageAccumulator | null;
  contextState: {
    facts: Record<string, string>;
    context: string;
    summarizedUpTo: number;
    factsExtractedUpTo: number;
  } | null;
  workingMemory: WorkingMemory | null;
};

export type ToolCallChunk = {
  type: "tool_call";
  toolName: string;
  serverName: string;
  arguments: Record<string, unknown>;
  result: unknown;
  isError: boolean;
};

export type StreamChunk =
  | { type: "delta"; content: string }
  | { type: "done"; content: string; usage: UsageAccumulator | null }
  | { type: "error"; error: string }
  | { type: "working_memory"; data: WorkingMemory }
  | { type: "machine_state"; data: StateMachineInstance }
  | { type: "invariant-violation"; name: string; description: string }
  | { type: "invariant-warning"; name: string; description: string }
  | ToolCallChunk;

export interface ContextStrategy {
  run(
    state: PipelineState,
    config: BranchConfig,
  ): Promise<PipelineState | null>;
}
