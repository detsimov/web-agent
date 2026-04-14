import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  ragChunkTable,
  ragCollectionTable,
  ragDocumentTable,
} from "@/db/schema";
import { generateEmbedding } from "./embeddings";
import { qdrant } from "./qdrant";
import type { SearchResult } from "./types";

export async function searchCollection(
  collectionId: number,
  query: string,
  limit = 5,
): Promise<SearchResult[]> {
  const [collection] = await db
    .select()
    .from(ragCollectionTable)
    .where(eq(ragCollectionTable.id, collectionId));

  if (!collection) return [];

  return searchSingleCollection(collection, query, limit);
}

export async function searchAllCollections(
  query: string,
  collectionSlugs?: string[],
  limit = 5,
): Promise<SearchResult[]> {
  let collections: {
    id: number;
    name: string;
    slug: string;
    embeddingModel: string;
    embeddingDimensions: number;
  }[];

  if (collectionSlugs && collectionSlugs.length > 0) {
    collections = await db
      .select()
      .from(ragCollectionTable)
      .where(inArray(ragCollectionTable.slug, collectionSlugs));
  } else {
    collections = await db.select().from(ragCollectionTable);
  }

  if (collections.length === 0) return [];

  // Search each collection in parallel
  const resultsPerCollection = await Promise.all(
    collections.map((c) => searchSingleCollection(c, query, limit)),
  );

  // Merge and sort by score
  return resultsPerCollection
    .flat()
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function searchSingleCollection(
  collection: {
    id: number;
    name: string;
    slug: string;
    embeddingModel: string;
  },
  query: string,
  limit: number,
): Promise<SearchResult[]> {
  const queryVector = await generateEmbedding(query, collection.embeddingModel);

  let qdrantResults: { id: string; score: number }[];
  try {
    const response = await qdrant.query(collection.slug, {
      query: queryVector,
      limit,
      with_payload: true,
    });
    qdrantResults = response.points.map((p) => ({
      id: p.id as string,
      score: p.score,
    }));
  } catch {
    return [];
  }

  if (qdrantResults.length === 0) return [];

  // Look up chunk content and document titles from SQLite
  const pointIds = qdrantResults.map((r) => r.id);
  const chunks = await db
    .select({
      qdrantPointId: ragChunkTable.qdrantPointId,
      content: ragChunkTable.content,
      chunkIndex: ragChunkTable.chunkIndex,
      documentTitle: ragDocumentTable.title,
    })
    .from(ragChunkTable)
    .innerJoin(
      ragDocumentTable,
      eq(ragChunkTable.documentId, ragDocumentTable.id),
    )
    .where(inArray(ragChunkTable.qdrantPointId, pointIds));

  const chunkMap = new Map(chunks.map((c) => [c.qdrantPointId, c]));

  return qdrantResults
    .map((r) => {
      const chunkData = chunkMap.get(r.id);
      if (!chunkData) return null;
      return {
        content: chunkData.content,
        score: r.score,
        documentTitle: chunkData.documentTitle,
        collectionName: collection.name,
        chunkIndex: chunkData.chunkIndex,
      };
    })
    .filter((r): r is SearchResult => r !== null);
}
