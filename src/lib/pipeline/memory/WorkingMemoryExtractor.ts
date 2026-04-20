import type { Agent } from "@/lib/agent/Agent";
import type { WorkingMemory, WorkingMemoryStep } from "@/lib/pipeline/types";
import type { PinnedSource, PinnedTerm } from "@/lib/rag/types";
import { validateWorkingMemoryUpdate } from "./validation";

export class WorkingMemoryExtractor {
  constructor(private agent: Agent) {}

  async extract(
    currentMemory: WorkingMemory,
    newMessages: Array<{ role: string; content: string }>,
  ): Promise<WorkingMemory> {
    const prompt = buildExtractionPrompt(currentMemory, newMessages);
    const result = await this.agent.complete([
      { role: "user", content: prompt },
    ]);

    const parsed = parseWorkingMemoryResponse(result.content);
    return validateWorkingMemoryUpdate(currentMemory, parsed);
  }
}

function buildExtractionPrompt(
  currentMemory: WorkingMemory,
  newMessages: Array<{ role: string; content: string }>,
): string {
  const messagesBlock = newMessages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  return `Current working memory:
${JSON.stringify(currentMemory, null, 2)}

New messages:
${messagesBlock}

Update the working memory JSON based on the new messages.
- Update summary to reflect current activity
- Update detail with expanded context
- If user explicitly asked for steps and none exist, create them
- If steps exist and not all done, only update their status
- Append significant actions to history
- Pinned knowledge registry (pinned):
  - Inspect the assistant messages for [RECENTLY RETRIEVED] content and citations of the form [collection-slug:doc-slug:chunk].
  - Promote a retrieved term into pinned ONLY when it is likely to recur in future turns (core vocabulary, decisions referenced more than once, entities the user keeps asking about).
  - Each pinned entry MUST carry at least one sources[] entry with { collectionSlug, docSlug, chunkIndex, knowledgeVersion } matching the citationId it was retrieved under, plus a stable pinnedAt ISO timestamp.
  - Preserve existing pinned entries that still apply; only remove an entry when it is clearly superseded or obsolete.
  - Registry is capped at 20 entries. Omit the field entirely when you have nothing to pin.
- Return ONLY valid JSON matching this schema: { "summary": string, "detail": string, "steps": [{ "name": string, "status": "done"|"active"|"pending" }], "history": [string], "pinned"?: [{ "term": string, "definition": string, "sources": [{ "collectionSlug": string, "docSlug": string, "chunkIndex": number, "knowledgeVersion": number }], "pinnedAt": string }] }`;
}

function parsePinnedSource(s: unknown): PinnedSource | null {
  if (!s || typeof s !== "object") return null;
  const src = s as Record<string, unknown>;
  if (
    typeof src.collectionSlug !== "string" ||
    typeof src.docSlug !== "string" ||
    typeof src.chunkIndex !== "number" ||
    typeof src.knowledgeVersion !== "number"
  ) {
    return null;
  }
  return {
    collectionSlug: src.collectionSlug,
    docSlug: src.docSlug,
    chunkIndex: Math.trunc(src.chunkIndex),
    knowledgeVersion: Math.trunc(src.knowledgeVersion),
  };
}

function parsePinnedEntry(p: unknown): PinnedTerm | null {
  if (!p || typeof p !== "object") return null;
  const entry = p as Record<string, unknown>;
  if (
    typeof entry.term !== "string" ||
    entry.term.length === 0 ||
    typeof entry.definition !== "string" ||
    !Array.isArray(entry.sources)
  ) {
    return null;
  }
  const sources = entry.sources
    .map(parsePinnedSource)
    .filter((s): s is PinnedSource => s !== null);
  if (sources.length === 0) return null;
  const pinnedAt =
    typeof entry.pinnedAt === "string" && entry.pinnedAt.length > 0
      ? entry.pinnedAt
      : new Date().toISOString();
  return {
    term: entry.term,
    definition: entry.definition,
    sources,
    pinnedAt,
  };
}

function parseWorkingMemoryResponse(content: string): WorkingMemory {
  const trimmed = content.trim();

  // Try to find JSON in the response
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in working memory extraction response");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  const result: WorkingMemory = {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    detail: typeof parsed.detail === "string" ? parsed.detail : "",
    steps: Array.isArray(parsed.steps)
      ? parsed.steps
          .filter(
            (s: unknown): s is WorkingMemoryStep =>
              typeof s === "object" &&
              s !== null &&
              "name" in s &&
              "status" in s,
          )
          .map((s: WorkingMemoryStep) => ({
            name: String(s.name),
            status: ["done", "active", "pending"].includes(s.status)
              ? s.status
              : "pending",
          }))
      : [],
    history: Array.isArray(parsed.history)
      ? parsed.history.filter((h: unknown) => typeof h === "string")
      : [],
  };

  if (Array.isArray(parsed.pinned)) {
    const pinned = parsed.pinned
      .map(parsePinnedEntry)
      .filter((p: PinnedTerm | null): p is PinnedTerm => p !== null);
    result.pinned = pinned;
  }

  return result;
}
