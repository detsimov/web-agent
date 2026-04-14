import { rebuildCollection } from "@/lib/rag/pipeline";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const collectionId = Number(id);

  try {
    const chunksProcessed = await rebuildCollection(collectionId);
    return Response.json({ ok: true, chunksProcessed });
  } catch (error) {
    console.error("POST /api/rag/collections/[id]/rebuild error:", error);
    const message = error instanceof Error ? error.message : "Rebuild failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
