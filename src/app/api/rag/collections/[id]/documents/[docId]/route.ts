import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  ragChunkTable,
  ragCollectionTable,
  ragDocumentTable,
} from "@/db/schema";
import { bumpKnowledgeVersion } from "@/lib/rag/pipeline";
import { qdrant } from "@/lib/rag/qdrant";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params;
  const collectionId = Number(id);
  const documentId = Number(docId);

  // Get collection for slug
  const [collection] = await db
    .select({ slug: ragCollectionTable.slug })
    .from(ragCollectionTable)
    .where(eq(ragCollectionTable.id, collectionId));

  if (!collection) {
    return Response.json({ error: "Collection not found" }, { status: 404 });
  }

  // Get chunk point IDs for Qdrant deletion
  const chunks = await db
    .select({ qdrantPointId: ragChunkTable.qdrantPointId })
    .from(ragChunkTable)
    .where(eq(ragChunkTable.documentId, documentId));

  // Delete from Qdrant
  if (chunks.length > 0) {
    try {
      await qdrant.delete(collection.slug, {
        points: chunks.map((c) => c.qdrantPointId),
      });
    } catch {
      // Qdrant may be unavailable
    }
  }

  // Cascade delete handles chunks
  await db.delete(ragDocumentTable).where(eq(ragDocumentTable.id, documentId));

  await bumpKnowledgeVersion(collectionId);

  return Response.json({ ok: true });
}
