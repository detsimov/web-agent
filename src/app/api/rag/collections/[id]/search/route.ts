import * as z from "zod";
import { searchCollection } from "@/lib/rag/search";

const SearchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(50).optional().default(5),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const body = await request.json();
    const { query, limit } = SearchSchema.parse(body);
    const { id } = await params;
    const collectionId = Number(id);

    const results = await searchCollection(collectionId, query, limit);
    return Response.json({ results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "Search failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
