import type {
  ChunkingConfig,
  ChunkingStrategy,
  ChunkResult,
  FixedChunkingConfig,
  RecursiveChunkingConfig,
  SentenceChunkingConfig,
} from "./types";

type Chunker = (text: string, config: ChunkingConfig) => ChunkResult[];

function fixedChunker(text: string, config: ChunkingConfig): ChunkResult[] {
  const { chunkSize, overlap } = config as FixedChunkingConfig;
  const chunks: ChunkResult[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push({ content: text.slice(start, end), index: index++ });
    start += chunkSize - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

function sentenceChunker(text: string, config: ChunkingConfig): ChunkResult[] {
  const { sentences: perChunk } = config as SentenceChunkingConfig;
  // Split on sentence-ending punctuation followed by whitespace
  const sentences = text.match(/[^.!?]*[.!?]+[\s]*/g) ?? [text];
  const chunks: ChunkResult[] = [];

  for (let i = 0; i < sentences.length; i += perChunk) {
    const group = sentences
      .slice(i, i + perChunk)
      .join("")
      .trim();
    if (group) {
      chunks.push({ content: group, index: chunks.length });
    }
  }

  return chunks;
}

function recursiveChunker(text: string, config: ChunkingConfig): ChunkResult[] {
  const { chunkSize, overlap = 0 } = config as RecursiveChunkingConfig;
  const separators = ["\n\n", "\n", ". ", " "];
  const results: string[] = [];

  function split(input: string, sepIndex: number) {
    if (input.length <= chunkSize) {
      results.push(input);
      return;
    }

    if (sepIndex >= separators.length) {
      // No more separators — force-split at chunkSize
      let start = 0;
      while (start < input.length) {
        results.push(input.slice(start, start + chunkSize));
        start += chunkSize - overlap;
      }
      return;
    }

    const sep = separators[sepIndex];
    const parts = input.split(sep);

    let buffer = "";
    for (const part of parts) {
      const candidate = buffer ? buffer + sep + part : part;
      if (candidate.length > chunkSize && buffer) {
        results.push(buffer);
        buffer = overlap > 0 ? buffer.slice(-overlap) + sep + part : part;
      } else if (candidate.length > chunkSize) {
        // Single part exceeds chunkSize — recurse with next separator
        split(part, sepIndex + 1);
        buffer = "";
      } else {
        buffer = candidate;
      }
    }

    if (buffer) {
      if (buffer.length > chunkSize) {
        split(buffer, sepIndex + 1);
      } else {
        results.push(buffer);
      }
    }
  }

  split(text, 0);

  return results
    .map((content, index) => ({ content: content.trim(), index }))
    .filter((c) => c.content.length > 0);
}

function markdownChunker(text: string, _config: ChunkingConfig): ChunkResult[] {
  // Split by headings (# ## ###) and code fences
  const lines = text.split("\n");
  const chunks: ChunkResult[] = [];
  let current: string[] = [];
  let headingContext = "";

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      // Flush current chunk
      if (current.length > 0) {
        const content = current.join("\n").trim();
        if (content) {
          chunks.push({ content, index: chunks.length });
        }
      }
      headingContext = line;
      current = [headingContext];
    } else {
      current.push(line);
    }
  }

  // Flush last chunk
  if (current.length > 0) {
    const content = current.join("\n").trim();
    if (content) {
      chunks.push({ content, index: chunks.length });
    }
  }

  return chunks;
}

const chunkers: Record<ChunkingStrategy, Chunker> = {
  fixed: fixedChunker,
  sentence: sentenceChunker,
  recursive: recursiveChunker,
  markdown: markdownChunker,
};

export function chunk(
  text: string,
  strategy: ChunkingStrategy,
  config: ChunkingConfig,
): ChunkResult[] {
  const chunker = chunkers[strategy];
  return chunker(text, config);
}
