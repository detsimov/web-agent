import { eq, sql } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import { ragCollectionTable } from "@/db/schema";
import { AppError } from "@/lib/error/AppError";
import { qdrant } from "@/lib/rag/qdrant";

const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(""),
  embeddingModel: z.string().min(1),
  embeddingDimensions: z.number().int().positive(),
  chunkingStrategy: z.enum(["fixed", "sentence", "recursive", "markdown"]),
  chunkingConfig: z.record(z.string(), z.unknown()).optional().default({}),
});

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET() {
  try {
    const collections = await db
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
      .from(ragCollectionTable);

    return Response.json(
      collections.map((c) => ({
        ...c,
        chunkingConfig: JSON.parse(c.chunkingConfig),
        needsRebuild: !!c.needsRebuild,
      })),
    );
  } catch (_error) {
    return Response.json(
      { error: "Failed to list collections" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = CreateCollectionSchema.parse(body);
    const slug = toSlug(data.name);

    // Check duplicate
    const [existing] = await db
      .select({ id: ragCollectionTable.id })
      .from(ragCollectionTable)
      .where(eq(ragCollectionTable.slug, slug));

    if (existing) {
      return Response.json(
        {
          error: "A collection with this name already exists",
          code: "DUPLICATE",
        },
        { status: 409 },
      );
    }

    // Create in Qdrant first — if it's down, fail fast before touching SQLite
    await qdrant.createCollection(slug, {
      vectors: {
        size: data.embeddingDimensions,
        distance: "Cosine",
      },
    });

    // Create in SQLite
    const [collection] = await db
      .insert(ragCollectionTable)
      .values({
        name: data.name,
        slug,
        description: data.description,
        embeddingModel: data.embeddingModel,
        embeddingDimensions: data.embeddingDimensions,
        chunkingStrategy: data.chunkingStrategy,
        chunkingConfig: JSON.stringify(data.chunkingConfig),
      })
      .returning();

    return Response.json({
      ...collection,
      chunkingConfig: data.chunkingConfig,
      needsRebuild: false,
      documentCount: 0,
      chunkCount: 0,
    });
  } catch (error) {
    console.error("POST /api/rag/collections error:", error);
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof AppError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Failed to create collection";
    return Response.json({ error: message }, { status: 500 });
  }
}
