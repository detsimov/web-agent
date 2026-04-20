import type { WorkingMemory } from "@/lib/pipeline/types";
import type { PinnedSource, PinnedTerm } from "@/lib/rag/types";

const MAX_PINNED = 20;

function isValidPinnedSource(s: unknown): s is PinnedSource {
  if (!s || typeof s !== "object") return false;
  const src = s as Record<string, unknown>;
  return (
    typeof src.collectionSlug === "string" &&
    typeof src.docSlug === "string" &&
    typeof src.chunkIndex === "number" &&
    Number.isInteger(src.chunkIndex) &&
    typeof src.knowledgeVersion === "number" &&
    Number.isInteger(src.knowledgeVersion)
  );
}

function isValidPinnedEntry(p: unknown): p is PinnedTerm {
  if (!p || typeof p !== "object") return false;
  const entry = p as Record<string, unknown>;
  return (
    typeof entry.term === "string" &&
    entry.term.length > 0 &&
    typeof entry.definition === "string" &&
    Array.isArray(entry.sources) &&
    entry.sources.length > 0 &&
    entry.sources.every(isValidPinnedSource) &&
    typeof entry.pinnedAt === "string"
  );
}

function normalizePinned(
  incoming: PinnedTerm[] | undefined,
): PinnedTerm[] | undefined {
  if (!incoming) return undefined;
  const valid = incoming.filter(isValidPinnedEntry);
  if (valid.length === 0) return [];
  if (valid.length <= MAX_PINNED) return valid;

  // FIFO eviction by pinnedAt ascending, keep newest MAX_PINNED
  const sorted = [...valid].sort(
    (a, b) => Date.parse(a.pinnedAt) - Date.parse(b.pinnedAt),
  );
  return sorted.slice(sorted.length - MAX_PINNED);
}

/**
 * Validates a working memory update against the immutability rules:
 * - If steps exist and not all are done, lock step names/order; only status changes allowed
 * - If all steps are done (or no steps), incoming can redefine steps freely
 * - Pinned registry is capped at 20 (FIFO by pinnedAt); invalid entries are dropped
 */
export function validateWorkingMemoryUpdate(
  current: WorkingMemory,
  incoming: WorkingMemory,
): WorkingMemory {
  const hasSteps = current.steps.length > 0;
  const allDone = current.steps.every((s) => s.status === "done");

  if (hasSteps && !allDone) {
    // Steps locked — preserve names and order, only update status
    incoming.steps = current.steps.map((cur, i) => ({
      name: cur.name,
      status: incoming.steps[i]?.status ?? cur.status,
    }));
  }

  const normalized = normalizePinned(incoming.pinned);
  if (normalized === undefined) {
    delete incoming.pinned;
  } else {
    incoming.pinned = normalized;
  }

  return incoming;
}
