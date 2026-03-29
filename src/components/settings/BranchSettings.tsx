export type BranchConfig = {
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
};

export type BranchContextState = {
  facts: Record<string, string>;
  context: string;
  summarizedUpTo: number;
  factsExtractedUpTo: number;
};
