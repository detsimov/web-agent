import { listEmbeddingModels } from "@/lib/rag/embeddings";

export async function GET() {
  try {
    const models = await listEmbeddingModels();
    return Response.json(models);
  } catch (_error) {
    return Response.json(
      { error: "Failed to list embedding models" },
      { status: 500 },
    );
  }
}
