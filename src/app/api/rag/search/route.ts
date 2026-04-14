import * as z from "zod";
import { searchAllCollections } from "@/lib/rag/search";

const CrossSearchSchema = z.object({
  query: z.string().min(1),
  collections: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(50).optional().default(5),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, collections, limit } = CrossSearchSchema.parse(body);

    const results = await searchAllCollections(query, collections, limit);
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
