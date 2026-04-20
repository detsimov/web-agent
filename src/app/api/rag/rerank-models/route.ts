const RERANK_MODELS: Array<{ id: string; name: string }> = [
  { id: "cohere/rerank-4-pro", name: "Cohere Rerank 4 Pro" },
  { id: "cohere/rerank-3.5", name: "Cohere Rerank 3.5" },
  { id: "cohere/rerank-english-v3.0", name: "Cohere Rerank English v3" },
  {
    id: "cohere/rerank-multilingual-v3.0",
    name: "Cohere Rerank Multilingual v3",
  },
];

export function GET() {
  return Response.json({ data: RERANK_MODELS });
}
