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

export type SearchResult = {
  content: string;
  score: number;
  documentTitle: string;
  collectionName: string;
  chunkIndex: number;
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
  documentCount?: number;
  chunkCount?: number;
};

export type RagDocument = {
  id: number;
  collectionId: number;
  title: string;
  sourceType: "file" | "text" | "agent";
  filename: string | null;
  contentHash: string;
  chunkCount: number;
  status: string;
  createdAt: Date;
};
