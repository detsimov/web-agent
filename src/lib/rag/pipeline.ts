import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  ragChunkTable,
  ragCollectionTable,
  ragDocumentTable,
} from "@/db/schema";
import { chunk } from "./chunking";
import { generateEmbeddings } from "./embeddings";
import { parseFile } from "./parsing";
import { qdrant } from "./qdrant";
import { resolveSlugCollision, toSlug } from "./slug";
import type { ChunkingConfig, ChunkingStrategy } from "./types";

async function bumpKnowledgeVersion(collectionId: number) {
  await db
    .update(ragCollectionTable)
    .set({
      knowledgeVersion: sql`${ragCollectionTable.knowledgeVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(ragCollectionTable.id, collectionId));
}

export { bumpKnowledgeVersion };

type IngestResult = {
  documentId: number;
  chunkCount: number;
};

export type ProgressEvent =
  | { stage: "parsing" }
  | { stage: "chunking"; totalChunks: number }
  | { stage: "embedding"; current: number; total: number }
  | { stage: "storing" }
  | { stage: "done"; documentId: number; chunkCount: number }
  | { stage: "error"; message: string };

type OnProgress = (event: ProgressEvent) => void;

export async function ingestFile(
  collectionId: number,
  file: File,
  onProgress?: OnProgress,
): Promise<IngestResult> {
  onProgress?.({ stage: "parsing" });
  const buffer = await file.arrayBuffer();
  const text = await parseFile(buffer, file.name);
  const contentHash = hashContent(text);

  const collection = await getCollection(collectionId);

  // Check duplicate
  await checkDuplicate(collectionId, contentHash);

  return ingestText(
    collection,
    file.name,
    text,
    contentHash,
    "file",
    file.name,
    onProgress,
  );
}

export async function ingestTextContent(
  collectionId: number,
  title: string,
  content: string,
  sourceType: "text" | "agent" = "text",
  onProgress?: OnProgress,
): Promise<IngestResult> {
  const contentHash = hashContent(content);
  const collection = await getCollection(collectionId);
  await checkDuplicate(collectionId, contentHash);
  return ingestText(
    collection,
    title,
    content,
    contentHash,
    sourceType,
    null,
    onProgress,
  );
}

async function ingestText(
  collection: {
    id: number;
    slug: string;
    embeddingModel: string;
    chunkingStrategy: string;
    chunkingConfig: string;
  },
  title: string,
  text: string,
  contentHash: string,
  sourceType: "file" | "text" | "agent",
  filename: string | null,
  onProgress?: OnProgress,
): Promise<IngestResult> {
  const config = JSON.parse(collection.chunkingConfig) as ChunkingConfig;
  const chunks = chunk(
    text,
    collection.chunkingStrategy as ChunkingStrategy,
    config,
  );

  onProgress?.({ stage: "chunking", totalChunks: chunks.length });

  // Embed in batches
  const BATCH_SIZE = 64;
  const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
  const allEmbeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    onProgress?.({
      stage: "embedding",
      current: batchNum,
      total: totalBatches,
    });
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddings = await generateEmbeddings(
      batch.map((c) => c.content),
      collection.embeddingModel,
    );
    allEmbeddings.push(...embeddings);
  }

  onProgress?.({ stage: "storing" });

  const baseSlug = toSlug(title) || `doc-${Date.now()}`;
  const slug = await resolveSlugCollision(collection.id, baseSlug);

  // Create document
  const [doc] = await db
    .insert(ragDocumentTable)
    .values({
      collectionId: collection.id,
      title,
      slug,
      sourceType,
      filename,
      contentHash,
      chunkCount: chunks.length,
      status: "ready",
    })
    .returning();

  // Store chunks in SQLite and vectors in Qdrant
  const pointIds: string[] = [];
  const chunkRows = chunks.map((c) => {
    const pointId = crypto.randomUUID();
    pointIds.push(pointId);
    return {
      documentId: doc.id,
      chunkIndex: c.index,
      content: c.content,
      qdrantPointId: pointId,
    };
  });

  if (chunkRows.length > 0) {
    await db.insert(ragChunkTable).values(chunkRows);

    await qdrant.upsert(collection.slug, {
      points: allEmbeddings.map((vector, i) => ({
        id: pointIds[i],
        vector,
        payload: {
          documentId: doc.id,
          chunkIndex: chunks[i].index,
        },
      })),
    });
  }

  await bumpKnowledgeVersion(collection.id);

  onProgress?.({
    stage: "done",
    documentId: doc.id,
    chunkCount: chunks.length,
  });

  return { documentId: doc.id, chunkCount: chunks.length };
}

export async function rebuildCollection(collectionId: number): Promise<number> {
  const [collection] = await db
    .select()
    .from(ragCollectionTable)
    .where(eq(ragCollectionTable.id, collectionId));
  if (!collection) throw new Error(`Collection ${collectionId} not found`);

  // Delete and recreate Qdrant collection (fresh start)
  try {
    await qdrant.deleteCollection(collection.slug);
  } catch {
    // May not exist
  }
  await qdrant.createCollection(collection.slug, {
    vectors: {
      size: collection.embeddingDimensions,
      distance: "Cosine",
    },
  });

  // Get all chunks from SQLite
  const chunks = await db
    .select({
      id: ragChunkTable.id,
      content: ragChunkTable.content,
      chunkIndex: ragChunkTable.chunkIndex,
      documentId: ragChunkTable.documentId,
      qdrantPointId: ragChunkTable.qdrantPointId,
    })
    .from(ragChunkTable)
    .innerJoin(
      ragDocumentTable,
      eq(ragChunkTable.documentId, ragDocumentTable.id),
    )
    .where(eq(ragDocumentTable.collectionId, collectionId));

  if (chunks.length === 0) {
    // Clear rebuild flag
    await db
      .update(ragCollectionTable)
      .set({
        needsRebuild: 0,
        knowledgeVersion: sql`${ragCollectionTable.knowledgeVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(ragCollectionTable.id, collectionId));
    return 0;
  }

  // Re-embed in batches
  const BATCH_SIZE = 64;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddings = await generateEmbeddings(
      batch.map((c) => c.content),
      collection.embeddingModel,
    );

    await qdrant.upsert(collection.slug, {
      points: embeddings.map((vector, j) => ({
        id: batch[j].qdrantPointId,
        vector,
        payload: {
          documentId: batch[j].documentId,
          chunkIndex: batch[j].chunkIndex,
        },
      })),
    });
  }

  // Clear rebuild flag
  await db
    .update(ragCollectionTable)
    .set({
      needsRebuild: 0,
      knowledgeVersion: sql`${ragCollectionTable.knowledgeVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(ragCollectionTable.id, collectionId));

  return chunks.length;
}

function hashContent(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function getCollection(collectionId: number) {
  const [collection] = await db
    .select()
    .from(ragCollectionTable)
    .where(eq(ragCollectionTable.id, collectionId));
  if (!collection) throw new Error(`Collection ${collectionId} not found`);

  // Ensure Qdrant collection exists
  try {
    await qdrant.getCollection(collection.slug);
  } catch {
    await qdrant.createCollection(collection.slug, {
      vectors: {
        size: collection.embeddingDimensions,
        distance: "Cosine",
      },
    });
  }

  return collection;
}

async function checkDuplicate(collectionId: number, contentHash: string) {
  const [existing] = await db
    .select({ id: ragDocumentTable.id })
    .from(ragDocumentTable)
    .where(
      and(
        eq(ragDocumentTable.collectionId, collectionId),
        eq(ragDocumentTable.contentHash, contentHash),
      ),
    )
    .limit(1);

  if (existing) {
    throw new DuplicateContentError();
  }
}

export class DuplicateContentError extends Error {
  constructor() {
    super("Content already exists in this collection");
  }
}
