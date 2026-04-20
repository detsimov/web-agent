import { and, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { ragDocumentTable } from "@/db/schema";

export function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function resolveSlugCollision(
  collectionId: number,
  base: string,
): Promise<string> {
  const safeBase = base.length > 0 ? base : "doc";

  const rows = await db
    .select({ slug: ragDocumentTable.slug })
    .from(ragDocumentTable)
    .where(
      and(
        eq(ragDocumentTable.collectionId, collectionId),
        like(ragDocumentTable.slug, `${safeBase}%`),
      ),
    );

  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(safeBase)) return safeBase;

  for (let n = 2; n < 10_000; n++) {
    const candidate = `${safeBase}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`Unable to resolve slug collision for "${safeBase}"`);
}
