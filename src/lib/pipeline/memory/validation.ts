import type { WorkingMemory } from "@/lib/pipeline/types";

/**
 * Validates a working memory update against the immutability rules:
 * - If steps exist and not all are done, lock step names/order; only status changes allowed
 * - If all steps are done (or no steps), incoming can redefine steps freely
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

  return incoming;
}
