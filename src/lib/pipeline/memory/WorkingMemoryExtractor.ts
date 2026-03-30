import type { Agent } from "@/lib/agent/Agent";
import type { WorkingMemory, WorkingMemoryStep } from "@/lib/pipeline/types";
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
- Return ONLY valid JSON matching this schema: { "summary": string, "detail": string, "steps": [{ "name": string, "status": "done"|"active"|"pending" }], "history": [string] }`;
}

function parseWorkingMemoryResponse(content: string): WorkingMemory {
  const trimmed = content.trim();

  // Try to find JSON in the response
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in working memory extraction response");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
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
}
