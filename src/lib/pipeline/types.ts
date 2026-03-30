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

export type StreamChunk =
  | { type: "delta"; content: string }
  | { type: "done"; content: string; usage: UsageAccumulator | null }
  | { type: "error"; error: string }
  | { type: "working_memory"; data: WorkingMemory };

export interface ContextStrategy {
  run(
    state: PipelineState,
    config: BranchConfig,
  ): Promise<PipelineState | null>;
}
