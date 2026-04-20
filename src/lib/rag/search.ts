import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  ragChunkTable,
  ragCollectionTable,
  ragDocumentTable,
} from "@/db/schema";
import { generateEmbedding } from "./embeddings";
import { qdrant } from "./qdrant";
import { rerankDocuments } from "./rerank";
import type { ClarificationMode, SearchEnvelope, SearchResult } from "./types";

export const CITATION_GUIDE =
  "Cite every factual claim derived from these results by appending its `citationId` in square brackets, using the form [collection-slug:doc-slug:chunk]. Do not merge citations and do not shorten the identifier.";

const MAX_LIMIT = 20;

type CollectionRow = {
  id: number;
  name: string;
  slug: string;
  embeddingModel: string;
  embeddingDimensions: number;
  vectorThreshold: number;
  rerankEnabled: number;
  rerankModel: string;
  rerankTopNInput: number;
  rerankThreshold: number;
  clarificationMode: string;
};

type Candidate = {
  collection: CollectionRow;
  qdrantPointId: string;
  content: string;
  chunkIndex: number;
  documentTitle: string;
  documentSlug: string;
  vectorScore: number;
  rerankScore: number | null;
};

function makeCitationId(
  collectionSlug: string,
  docSlug: string,
  chunkIndex: number,
): string {
  return `${collectionSlug}:${docSlug}:${chunkIndex}`;
}

function toSearchResult(c: Candidate): SearchResult {
  return {
    citationId: makeCitationId(c.collection.slug, c.documentSlug, c.chunkIndex),
    content: c.content,
    vectorScore: c.vectorScore,
    rerankScore: c.rerankScore,
    documentTitle: c.documentTitle,
    documentSlug: c.documentSlug,
    collectionName: c.collection.name,
    collectionSlug: c.collection.slug,
    chunkIndex: c.chunkIndex,
  };
}

function strictestMode(modes: (string | undefined)[]): ClarificationMode {
  for (const m of modes) {
    if (m === "strict") return "strict";
  }
  return "soft";
}

function clarificationSuggestion(mode: ClarificationMode): string {
  return mode === "strict"
    ? "Do not answer from general knowledge. Ask the user to clarify or narrow the query so the knowledge base can help."
    : "The knowledge base did not find a direct answer. You may answer from general knowledge, but state explicitly that the answer is not sourced from the user's knowledge base.";
}

function emptyEnvelope(
  modes: (string | undefined)[],
  reason: string,
): SearchEnvelope {
  const mode = strictestMode(modes);
  return {
    results: [],
    needsClarification: true,
    clarificationMode: mode,
    reason,
    suggestion: clarificationSuggestion(mode),
  };
}

async function fetchCandidates(
  collection: CollectionRow,
  query: string,
): Promise<{ candidates: Candidate[]; qdrantAvailable: boolean }> {
  const queryVector = await generateEmbedding(query, collection.embeddingModel);

  let qdrantResults: { id: string; score: number }[];
  try {
    const response = await qdrant.query(collection.slug, {
      query: queryVector,
      limit: collection.rerankTopNInput,
      with_payload: true,
    });
    qdrantResults = response.points.map((p) => ({
      id: p.id as string,
      score: p.score,
    }));
  } catch {
    return { candidates: [], qdrantAvailable: false };
  }

  if (qdrantResults.length === 0) {
    return { candidates: [], qdrantAvailable: true };
  }

  const filtered = qdrantResults.filter(
    (r) => r.score >= collection.vectorThreshold,
  );
  if (filtered.length === 0) {
    return { candidates: [], qdrantAvailable: true };
  }

  const pointIds = filtered.map((r) => r.id);
  const chunks = await db
    .select({
      qdrantPointId: ragChunkTable.qdrantPointId,
      content: ragChunkTable.content,
      chunkIndex: ragChunkTable.chunkIndex,
      documentTitle: ragDocumentTable.title,
      documentSlug: ragDocumentTable.slug,
    })
    .from(ragChunkTable)
    .innerJoin(
      ragDocumentTable,
      eq(ragChunkTable.documentId, ragDocumentTable.id),
    )
    .where(inArray(ragChunkTable.qdrantPointId, pointIds));

  const chunkMap = new Map(chunks.map((c) => [c.qdrantPointId, c]));

  const candidates: Candidate[] = [];
  for (const r of filtered) {
    const chunk = chunkMap.get(r.id);
    if (!chunk) continue;
    candidates.push({
      collection,
      qdrantPointId: r.id,
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      documentTitle: chunk.documentTitle,
      documentSlug: chunk.documentSlug,
      vectorScore: r.score,
      rerankScore: null,
    });
  }

  return { candidates, qdrantAvailable: true };
}

async function rerankCandidates(
  collection: CollectionRow,
  query: string,
  candidates: Candidate[],
): Promise<{ ranked: Candidate[]; rerankFailed: boolean }> {
  if (candidates.length === 0) return { ranked: [], rerankFailed: false };
  if (!collection.rerankEnabled) {
    const ranked = [...candidates].sort(
      (a, b) => b.vectorScore - a.vectorScore,
    );
    return { ranked, rerankFailed: false };
  }

  const rerankResults = await rerankDocuments({
    model: collection.rerankModel,
    query,
    documents: candidates.map((c) => c.content),
  });

  if (!rerankResults) {
    const ranked = [...candidates].sort(
      (a, b) => b.vectorScore - a.vectorScore,
    );
    return { ranked, rerankFailed: true };
  }

  const scored: Candidate[] = [];
  for (const r of rerankResults) {
    const source = candidates[r.index];
    if (!source) continue;
    if (r.relevanceScore < collection.rerankThreshold) continue;
    scored.push({ ...source, rerankScore: r.relevanceScore });
  }

  scored.sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0));
  return { ranked: scored, rerankFailed: false };
}

export async function searchCollection(
  collectionId: number,
  query: string,
  limit = 5,
): Promise<SearchEnvelope> {
  const [collection] = await db
    .select()
    .from(ragCollectionTable)
    .where(eq(ragCollectionTable.id, collectionId));

  if (!collection) {
    return emptyEnvelope([undefined], "Collection not found");
  }

  return searchCollections([collection as CollectionRow], query, limit);
}

export async function searchAllCollections(
  query: string,
  collectionSlugs?: string[],
  limit = 5,
): Promise<SearchEnvelope> {
  const allCollections = (await db
    .select()
    .from(ragCollectionTable)) as CollectionRow[];

  if (allCollections.length === 0) {
    return {
      results: [],
      needsClarification: true,
      reason: "No collections configured",
      suggestion:
        "The user has no knowledge base collections. Ask the user to create one or answer from general knowledge while disclosing that no knowledge base exists.",
    };
  }

  let collections: CollectionRow[];

  if (collectionSlugs && collectionSlugs.length > 0) {
    const slugSet = new Set(collectionSlugs);
    collections = allCollections.filter((c) => slugSet.has(c.slug));

    if (collections.length === 0) {
      const availableList = allCollections.map((c) => c.slug).join(", ");
      return {
        results: [],
        needsClarification: true,
        reason: `None of the requested collection slugs matched. Requested: ${collectionSlugs.join(", ")}. Available: ${availableList}`,
        suggestion: `Retry rag_search without the collections argument to search all collections, or use one of: ${availableList}.`,
      };
    }
  } else {
    collections = allCollections;
  }

  return searchCollections(collections, query, limit);
}

async function searchCollections(
  collections: CollectionRow[],
  query: string,
  limit: number,
): Promise<SearchEnvelope> {
  const cappedLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);

  const collectionModes = collections.map((c) => c.clarificationMode);

  const candidatePerCollection = await Promise.all(
    collections.map((c) => fetchCandidates(c, query)),
  );

  const totalCandidates = candidatePerCollection.flatMap((x) => x.candidates);
  if (totalCandidates.length === 0) {
    return emptyEnvelope(
      collectionModes,
      "No results above the configured vector similarity threshold",
    );
  }

  let ranked: Candidate[] = [];
  let rerankFailed = false;

  const rerankEnabledCollections = collections.filter(
    (c) => c.rerankEnabled && c.rerankModel,
  );
  const uniqueRerankModels = new Set(
    rerankEnabledCollections.map((c) => c.rerankModel),
  );

  const allEnabled =
    collections.length > 0 &&
    collections.every((c) => c.rerankEnabled) &&
    uniqueRerankModels.size === 1;

  if (allEnabled) {
    const model = collections[0].rerankModel;
    const strictestRerankThreshold = Math.max(
      ...collections.map((c) => c.rerankThreshold),
    );
    const syntheticCollection: CollectionRow = {
      ...collections[0],
      rerankEnabled: 1,
      rerankModel: model,
      rerankThreshold: strictestRerankThreshold,
    };
    const r = await rerankCandidates(
      syntheticCollection,
      query,
      totalCandidates,
    );
    ranked = r.ranked;
    rerankFailed = r.rerankFailed;
  } else {
    const perCollection = await Promise.all(
      collections.map(async (c, idx) => {
        const cand = candidatePerCollection[idx].candidates;
        return rerankCandidates(c, query, cand);
      }),
    );
    ranked = perCollection.flatMap((p) => p.ranked);
    rerankFailed = perCollection.some((p) => p.rerankFailed);

    ranked.sort((a, b) => {
      const aScore = a.rerankScore ?? a.vectorScore;
      const bScore = b.rerankScore ?? b.vectorScore;
      return bScore - aScore;
    });
  }

  if (ranked.length === 0) {
    const envelope = emptyEnvelope(
      collectionModes,
      "All candidates were filtered out by the rerank threshold",
    );
    if (rerankFailed) envelope.rerankFailed = true;
    return envelope;
  }

  const results = ranked.slice(0, cappedLimit).map(toSearchResult);

  const envelope: SearchEnvelope = {
    results,
    citationGuide: CITATION_GUIDE,
  };
  if (rerankFailed) envelope.rerankFailed = true;
  return envelope;
}
