export type ChunkingStrategy = "fixed" | "sentence" | "recursive" | "markdown";

export type FixedChunkingConfig = {
  chunkSize: number;
  overlap: number;
};

export type SentenceChunkingConfig = {
  sentences: number;
};

export type RecursiveChunkingConfig = {
  chunkSize: number;
  overlap?: number;
};

export type MarkdownChunkingConfig = {
  maxChunkSize?: number;
};

export type ChunkingConfig =
  | FixedChunkingConfig
  | SentenceChunkingConfig
  | RecursiveChunkingConfig
  | MarkdownChunkingConfig;

export type ChunkResult = {
  content: string;
  index: number;
};

export type ClarificationMode = "soft" | "strict";

export type SearchResult = {
  citationId: string;
  content: string;
  vectorScore: number;
  rerankScore: number | null;
  documentTitle: string;
  documentSlug: string;
  collectionName: string;
  collectionSlug: string;
  chunkIndex: number;
  stale?: boolean;
};

export type SearchEnvelope = {
  results: SearchResult[];
  citationGuide?: string;
  needsClarification?: boolean;
  clarificationMode?: ClarificationMode;
  reason?: string;
  suggestion?: string;
  rerankFailed?: boolean;
};

export type PinnedSource = {
  collectionSlug: string;
  docSlug: string;
  chunkIndex: number;
  knowledgeVersion: number;
};

export type PinnedTerm = {
  term: string;
  definition: string;
  sources: PinnedSource[];
  pinnedAt: string;
};

export type RagCollection = {
  id: number;
  name: string;
  slug: string;
  description: string;
  embeddingModel: string;
  embeddingDimensions: number;
  chunkingStrategy: ChunkingStrategy;
  chunkingConfig: ChunkingConfig;
  needsRebuild: boolean;
  vectorThreshold: number;
  rerankEnabled: boolean;
  rerankModel: string;
  rerankTopNInput: number;
  rerankThreshold: number;
  clarificationMode: ClarificationMode;
  knowledgeVersion: number;
  documentCount?: number;
  chunkCount?: number;
};

export type RagDocument = {
  id: number;
  collectionId: number;
  title: string;
  slug: string;
  sourceType: "file" | "text" | "agent";
  filename: string | null;
  contentHash: string;
  chunkCount: number;
  status: string;
  createdAt: Date;
};
