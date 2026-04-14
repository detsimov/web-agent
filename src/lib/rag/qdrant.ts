import { QdrantClient } from "@qdrant/js-client-rest";

const GLOBAL_KEY = "__qdrantClient__" as const;

const globalObj = globalThis as typeof globalThis & {
  [GLOBAL_KEY]?: QdrantClient;
};

if (!globalObj[GLOBAL_KEY]) {
  globalObj[GLOBAL_KEY] = new QdrantClient({
    url: process.env.QDRANT_URL ?? "http://localhost:6333",
  });
}

export const qdrant: QdrantClient = globalObj[GLOBAL_KEY];
