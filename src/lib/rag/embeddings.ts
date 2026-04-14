import { openRouter } from "@/lib/openrouter";

export async function generateEmbeddings(
  texts: string[],
  model: string,
): Promise<number[][]> {
  let response: Awaited<ReturnType<typeof openRouter.embeddings.generate>>;
  try {
    response = await openRouter.embeddings.generate({
      requestBody: {
        input: texts,
        model,
      },
    });
  } catch (error) {
    console.error(
      `Embedding error (model=${model}, texts=${texts.length}):`,
      error,
    );
    throw error;
  }

  if (typeof response === "string") {
    throw new Error(`Unexpected embedding response: ${response}`);
  }

  return response.data
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((d) => {
      if (typeof d.embedding === "string") {
        throw new Error("Base64 embedding format not supported");
      }
      return d.embedding;
    });
}

export async function generateEmbedding(
  text: string,
  model: string,
): Promise<number[]> {
  const [embedding] = await generateEmbeddings([text], model);
  return embedding;
}

export async function listEmbeddingModels() {
  return openRouter.embeddings.listModels();
}
