import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  ragChunkTable,
  ragCollectionTable,
  ragDocumentTable,
} from "@/db/schema";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      collectionSlug: string;
      docSlug: string;
      chunkIndex: string;
    }>;
  },
) {
  const { collectionSlug, docSlug, chunkIndex } = await params;
  const chunkIdx = Number(chunkIndex);

  if (!Number.isFinite(chunkIdx) || chunkIdx < 0) {
    return Response.json({ error: "Invalid chunk index" }, { status: 400 });
  }

  const [row] = await db
    .select({
      content: ragChunkTable.content,
      chunkIndex: ragChunkTable.chunkIndex,
      documentTitle: ragDocumentTable.title,
      documentId: ragDocumentTable.id,
      collectionName: ragCollectionTable.name,
      collectionId: ragCollectionTable.id,
    })
    .from(ragChunkTable)
    .innerJoin(
      ragDocumentTable,
      eq(ragChunkTable.documentId, ragDocumentTable.id),
    )
    .innerJoin(
      ragCollectionTable,
      eq(ragDocumentTable.collectionId, ragCollectionTable.id),
    )
    .where(
      and(
        eq(ragCollectionTable.slug, collectionSlug),
        eq(ragDocumentTable.slug, docSlug),
        eq(ragChunkTable.chunkIndex, chunkIdx),
      ),
    )
    .limit(1);

  if (!row) {
    return Response.json({ error: "Chunk not found" }, { status: 404 });
  }

  return Response.json(row);
}
