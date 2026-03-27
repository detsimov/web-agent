import type { PersistedMessage } from "@/lib/types";

export type PercentageSummarization = {
  strategy: "percentage";
  ratio: number;
  keep: number;
};

export type WindowSummarization = {
  strategy: "window";
  every: number;
  keep: number;
};

export type ContextSummarizationOptions =
  | PercentageSummarization
  | WindowSummarization;

export type RealContext = {
  messages: PersistedMessage[];
  core?: string[];
  context?: string;
  summarizedUpTo?: number;
  lastUsage: {
    totalTokens: number;
    maxTokens: number;
  };
};

export type PrepareResult = {
  messages: PersistedMessage[];
  core: string[];
  context: string;
  summarizedUpTo: number;
  dirty: boolean;
};
