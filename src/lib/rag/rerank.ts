import { openRouter } from "@/lib/openrouter";

export type RerankInput = {
  model: string;
  query: string;
  documents: string[];
  topN?: number;
};

export type RerankResult = {
  index: number;
  relevanceScore: number;
};

export async function rerankDocuments(
  input: RerankInput,
): Promise<RerankResult[] | null> {
  if (input.documents.length === 0) return [];

  try {
    const response = await openRouter.rerank.rerank({
      requestBody: {
        model: input.model,
        query: input.query,
        documents: input.documents,
        topN: input.topN,
      },
    });

    if (typeof response === "string") {
      console.warn(
        `Rerank returned string response (model=${input.model}, query="${input.query.slice(0, 60)}")`,
      );
      return null;
    }

    if (!Array.isArray(response.results)) {
      console.warn(
        `Rerank returned malformed results (model=${input.model}, query="${input.query.slice(0, 60)}")`,
      );
      return null;
    }

    return response.results
      .map((r) => ({
        index: r.index,
        relevanceScore: r.relevanceScore,
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  } catch (error) {
    console.warn(
      `Rerank failed (model=${input.model}, query="${input.query.slice(0, 60)}"):`,
      error,
    );
    return null;
  }
}
