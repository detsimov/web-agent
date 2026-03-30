import type { Agent } from "@/lib/agent/Agent";
import type { WorkingMemory } from "@/lib/pipeline/types";

export type UnifiedFactsInput = {
  globalFacts: Record<string, string>;
  localFacts: Record<string, string>;
  workingMemory: WorkingMemory;
  newMessages: Array<{ role: string; content: string }>;
  rules: string;
};

export type UnifiedFactsResult = {
  global: Record<string, string>;
  local: Record<string, string>;
};

export class UnifiedFactsExtractor {
  constructor(private agent: Agent) {}

  async extract(input: UnifiedFactsInput): Promise<UnifiedFactsResult> {
    const prompt = buildUnifiedFactsPrompt(input);
    const result = await this.agent.complete([
      { role: "user", content: prompt },
    ]);
    return parseUnifiedFactsResponse(result.content);
  }
}

function buildUnifiedFactsPrompt(input: UnifiedFactsInput): string {
  const globalBlock =
    Object.keys(input.globalFacts).length > 0
      ? Object.entries(input.globalFacts)
          .map(([k, v]) => `${k} = ${v}`)
          .join("\n")
      : "None";

  const localBlock =
    Object.keys(input.localFacts).length > 0
      ? Object.entries(input.localFacts)
          .map(([k, v]) => `${k} = ${v}`)
          .join("\n")
      : "None";

  const memoryBlock = JSON.stringify(input.workingMemory);

  const messagesBlock = input.newMessages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const rulesBlock = input.rules ? `\nExtraction rules:\n${input.rules}\n` : "";

  return `Current global facts (personal, cross-chat):
${globalBlock}

Current local facts (contextual, this conversation):
${localBlock}

Current working memory:
${memoryBlock}

New messages:
${messagesBlock}
${rulesBlock}
Extract facts from the new messages. Classify each as:
- global: personal info about the user (name, age, job, preferences, tone, language)
- local: contextual info about this conversation (topic, tools used, decisions made)

Return JSON:
{ "global": { "key": "value", ... }, "local": { "key": "value", ... } }

If no new facts found, return: { "global": {}, "local": {} }
Merge with existing facts. To remove a fact, set its value to null.
Return ONLY valid JSON, no other text.`;
}

function parseUnifiedFactsResponse(content: string): UnifiedFactsResult {
  const trimmed = content.trim();

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { global: {}, local: {} };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      global: isStringRecord(parsed.global) ? parsed.global : {},
      local: isStringRecord(parsed.local) ? parsed.local : {},
    };
  } catch {
    return { global: {}, local: {} };
  }
}

function isStringRecord(
  value: unknown,
): value is Record<string, string | null> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  for (const v of Object.values(value)) {
    if (v !== null && typeof v !== "string") return false;
  }
  return true;
}
