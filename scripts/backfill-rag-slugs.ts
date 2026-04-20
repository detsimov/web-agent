import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ragDocumentTable } from "@/db/schema";
import { toSlug } from "@/lib/rag/slug";

async function main() {
  const docs = await db
    .select({
      id: ragDocumentTable.id,
      collectionId: ragDocumentTable.collectionId,
      title: ragDocumentTable.title,
      slug: ragDocumentTable.slug,
    })
    .from(ragDocumentTable);

  const perCollection = new Map<number, Set<string>>();
  for (const d of docs) {
    let set = perCollection.get(d.collectionId);
    if (!set) {
      set = new Set();
      perCollection.set(d.collectionId, set);
    }
    if (d.slug && d.slug.length > 0) {
      set.add(d.slug);
    }
  }

  let updated = 0;
  for (const d of docs) {
    if (d.slug && d.slug.length > 0) continue;

    const base = toSlug(d.title) || `doc-${d.id}`;
    const taken = perCollection.get(d.collectionId) ?? new Set<string>();

    let candidate = base;
    let n = 2;
    while (taken.has(candidate)) {
      candidate = `${base}-${n}`;
      n++;
    }
    taken.add(candidate);

    await db
      .update(ragDocumentTable)
      .set({ slug: candidate })
      .where(eq(ragDocumentTable.id, d.id));

    console.log(
      `doc ${d.id} (collection ${d.collectionId}): "${d.title}" -> ${candidate}`,
    );
    updated++;
  }

  console.log(`Backfilled ${updated} document slug(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
