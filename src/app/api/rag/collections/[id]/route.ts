import { eq, sql } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import { ragCollectionTable } from "@/db/schema";
import { qdrant } from "@/lib/rag/qdrant";

const UpdateCollectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  embeddingModel: z.string().min(1).optional(),
  embeddingDimensions: z.number().int().positive().optional(),
  chunkingStrategy: z
    .enum(["fixed", "sentence", "recursive", "markdown"])
    .optional(),
  chunkingConfig: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const collectionId = Number(id);

  const [collection] = await db
    .select({
      id: ragCollectionTable.id,
      name: ragCollectionTable.name,
      slug: ragCollectionTable.slug,
      description: ragCollectionTable.description,
      embeddingModel: ragCollectionTable.embeddingModel,
      embeddingDimensions: ragCollectionTable.embeddingDimensions,
      chunkingStrategy: ragCollectionTable.chunkingStrategy,
      chunkingConfig: ragCollectionTable.chunkingConfig,
      needsRebuild: ragCollectionTable.needsRebuild,
      createdAt: ragCollectionTable.createdAt,
      documentCount: sql<number>`(SELECT COUNT(*) FROM rag_document WHERE collection_id = rag_collection.id)`,
      chunkCount: sql<number>`(SELECT COUNT(*) FROM rag_chunk WHERE document_id IN (SELECT id FROM rag_document WHERE collection_id = rag_collection.id))`,
    })
    .from(ragCollectionTable)
    .where(eq(ragCollectionTable.id, collectionId));

  if (!collection) {
    return Response.json({ error: "Collection not found" }, { status: 404 });
  }

  return Response.json({
    ...collection,
    chunkingConfig: JSON.parse(collection.chunkingConfig),
    needsRebuild: !!collection.needsRebuild,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const collectionId = Number(id);

  try {
    const body = await request.json();
    const data = UpdateCollectionSchema.parse(body);

    const [existing] = await db
      .select()
      .from(ragCollectionTable)
      .where(eq(ragCollectionTable.id, collectionId));

    if (!existing) {
      return Response.json({ error: "Collection not found" }, { status: 404 });
    }

    // Check if embedding model changed
    const modelChanged =
      (data.embeddingModel &&
        data.embeddingModel !== existing.embeddingModel) ||
      (data.embeddingDimensions &&
        data.embeddingDimensions !== existing.embeddingDimensions);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.embeddingModel !== undefined)
      updates.embeddingModel = data.embeddingModel;
    if (data.embeddingDimensions !== undefined)
      updates.embeddingDimensions = data.embeddingDimensions;
    if (data.chunkingStrategy !== undefined)
      updates.chunkingStrategy = data.chunkingStrategy;
    if (data.chunkingConfig !== undefined)
      updates.chunkingConfig = JSON.stringify(data.chunkingConfig);
    if (modelChanged) updates.needsRebuild = 1;

    const [updated] = await db
      .update(ragCollectionTable)
      .set(updates)
      .where(eq(ragCollectionTable.id, collectionId))
      .returning();

    return Response.json({
      ...updated,
      chunkingConfig: JSON.parse(updated.chunkingConfig),
      needsRebuild: !!updated.needsRebuild,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 },
      );
    }
    return Response.json(
      { error: "Failed to update collection" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const collectionId = Number(id);

  const [collection] = await db
    .select()
    .from(ragCollectionTable)
    .where(eq(ragCollectionTable.id, collectionId));

  if (!collection) {
    return Response.json({ error: "Collection not found" }, { status: 404 });
  }

  // Delete Qdrant collection
  try {
    await qdrant.deleteCollection(collection.slug);
  } catch {
    // May not exist in Qdrant
  }

  // Cascade delete handles documents and chunks
  await db
    .delete(ragCollectionTable)
    .where(eq(ragCollectionTable.id, collectionId));

  return Response.json({ ok: true });
}
