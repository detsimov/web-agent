import type { PersistedMessage } from "@/lib/types";
import type { UsageAccumulator } from "./types";

export function parseSummaryResponse(response: string): {
  facts: Record<string, string>;
  context: string;
} {
  const factsMatch = response.indexOf("[FACTS]");
  const contextMatch = response.indexOf("[CONTEXT]");

  if (factsMatch === -1 || contextMatch === -1) {
    return { facts: {}, context: response.trim() };
  }

  const factsBlock = response.slice(
    factsMatch + "[FACTS]".length,
    contextMatch,
  );
  const contextBlock = response.slice(contextMatch + "[CONTEXT]".length);

  const facts = parseFacts(factsBlock);
  const context = contextBlock.trim();

  return { facts, context };
}

export function parseFacts(block: string): Record<string, string> {
  const facts: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key) {
      facts[key] = value;
    }
  }
  return facts;
}

export function addUsage(
  acc: UsageAccumulator,
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number | null;
  } | null,
): UsageAccumulator {
  if (!usage) return acc;
  return {
    inputTokens: acc.inputTokens + usage.inputTokens,
    outputTokens: acc.outputTokens + usage.outputTokens,
    totalTokens: acc.totalTokens + usage.totalTokens,
    cost: (acc.cost ?? 0) + (usage.cost ?? 0),
  };
}

export function formatMessages(messages: PersistedMessage[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
}

export function formatFacts(facts: Record<string, string>): string {
  const entries = Object.entries(facts);
  return entries.length > 0
    ? entries.map(([k, v]) => `${k} = ${v}`).join("\n")
    : "None";
}
