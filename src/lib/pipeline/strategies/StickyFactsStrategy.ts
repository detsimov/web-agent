import type { Agent } from "@/lib/agent/Agent";
import type {
  BranchConfig,
  ContextStrategy,
  PipelineState,
} from "@/lib/pipeline/types";
import {
  addUsage,
  formatFacts,
  formatMessages,
  parseFacts,
} from "@/lib/pipeline/utils";

export class StickyFactsStrategy implements ContextStrategy {
  constructor(
    private agent: Agent,
    private baseKeys: string[],
    private rules: string,
  ) {}

  async run(
    state: PipelineState,
    config: BranchConfig,
  ): Promise<PipelineState | null> {
    const effectiveCursor = Math.max(
      state.cursors.factsExtractedUpTo,
      state.cursors.summarizedUpTo,
    );
    const unextracted = state.messages.filter((m) => m.id > effectiveCursor);

    if (unextracted.length < config.stickyFactsEvery) return null;

    const prompt = this.buildPrompt(state.facts, unextracted);
    const result = await this.agent.complete([
      { role: "user", content: prompt },
    ]);

    const trimmed = result.content.trim();
    const lastId = unextracted[unextracted.length - 1].id;

    let newFacts = state.facts;
    if (trimmed !== "NO_CHANGES") {
      const factsIndex = trimmed.indexOf("[FACTS]");
      if (factsIndex !== -1) {
        newFacts = parseFacts(trimmed.slice(factsIndex + "[FACTS]".length));
      }
    }

    return {
      ...state,
      facts: newFacts,
      cursors: {
        ...state.cursors,
        factsExtractedUpTo: lastId,
      },
      usage: addUsage(state.usage, result.usage),
    } satisfies PipelineState;
  }

  private buildPrompt(
    currentFacts: Record<string, string>,
    messages: import("@/lib/types").PersistedMessage[],
  ): string {
    const parts: string[] = [];

    if (this.rules) {
      parts.push(`[RULES]\n${this.rules}`);
    }

    if (this.baseKeys.length > 0) {
      parts.push(`[BASE KEYS]\n${this.baseKeys.join(", ")}`);
    }

    parts.push(`[CURRENT FACTS]\n${formatFacts(currentFacts)}`);
    parts.push(`[NEW MESSAGES]\n${formatMessages(messages)}`);

    return parts.join("\n\n");
  }
}
