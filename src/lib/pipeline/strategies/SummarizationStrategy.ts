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
  parseSummaryResponse,
} from "@/lib/pipeline/utils";

export class SummarizationStrategy implements ContextStrategy {
  constructor(private agent: Agent) {}

  async run(
    state: PipelineState,
    config: BranchConfig,
  ): Promise<PipelineState | null> {
    const unsummarized = state.messages.filter(
      (m) => m.id > state.cursors.summarizedUpTo,
    );

    if (!this.shouldTrigger(unsummarized.length, config)) return null;
    if (unsummarized.length <= config.summarizationKeep) return null;

    const toSummarize = unsummarized.slice(
      0,
      unsummarized.length - config.summarizationKeep,
    );
    const toKeep = unsummarized.slice(-config.summarizationKeep);

    const prompt = this.buildSummarizerInput(
      state.facts,
      state.context,
      toSummarize,
    );

    const result = await this.agent.complete([
      { role: "user", content: prompt },
    ]);

    const parsed = parseSummaryResponse(result.content);
    const lastId = toSummarize[toSummarize.length - 1].id;

    return {
      messages: toKeep,
      facts: parsed.facts,
      context: parsed.context,
      cursors: {
        ...state.cursors,
        summarizedUpTo: lastId,
      },
      usage: addUsage(state.usage, result.usage),
    };
  }

  private shouldTrigger(
    unsummarizedCount: number,
    config: BranchConfig,
  ): boolean {
    if (config.summarizationTrigger === "window") {
      return unsummarizedCount >= config.summarizationEvery;
    }
    return (
      config.lastTotalTokens / config.maxTokens >= config.summarizationRatio
    );
  }

  private buildSummarizerInput(
    previousFacts: Record<string, string>,
    previousContext: string,
    messages: import("@/lib/types").PersistedMessage[],
  ): string {
    const factsSection = formatFacts(previousFacts);
    const contextSection = previousContext || "None";
    const messagesSection = formatMessages(messages);

    return `[Previous FACTS]\n${factsSection}\n\n[Previous CONTEXT]\n${contextSection}\n\n[New Messages]\n${messagesSection}`;
  }
}
