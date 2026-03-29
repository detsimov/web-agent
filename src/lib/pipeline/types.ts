import type { PersistedMessage } from "@/lib/types";

export type PipelineState = {
  messages: PersistedMessage[];
  facts: Record<string, string>;
  context: string;
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
};

export type StreamChunk =
  | { type: "delta"; content: string }
  | { type: "done"; content: string; usage: UsageAccumulator | null }
  | { type: "error"; error: string };

export interface ContextStrategy {
  run(
    state: PipelineState,
    config: BranchConfig,
  ): Promise<PipelineState | null>;
}
