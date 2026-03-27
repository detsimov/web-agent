import type { Agent } from "@/lib/agent/Agent";
import { DEFAULT_CONTEXT_SUMMARIZATION } from "@/lib/context/constants";
import type {
  ContextSummarizationOptions,
  PrepareResult,
  RealContext,
} from "@/lib/context/types";
import type { PersistedMessage } from "@/lib/types";

export class ContextManager {
  private options: ContextSummarizationOptions;
  private agent: Agent;

  constructor(options: ContextSummarizationOptions | undefined, agent: Agent) {
    this.options = options ?? DEFAULT_CONTEXT_SUMMARIZATION;
    this.agent = agent;
  }

  async prepare(context: RealContext): Promise<PrepareResult> {
    const summarizedUpTo = context.summarizedUpTo ?? 0;
    const unsummarized = context.messages.filter((m) => m.id > summarizedUpTo);
    const previousCore = context.core ?? [];
    const previousContext = context.context ?? "";

    if (
      !this.shouldSummarize(unsummarized, context.lastUsage) ||
      unsummarized.length <= this.options.keep
    ) {
      return {
        messages: unsummarized,
        core: previousCore,
        context: previousContext,
        summarizedUpTo,
        dirty: false,
      };
    }

    const toSummarize = unsummarized.slice(
      0,
      unsummarized.length - this.options.keep,
    );
    const toKeep = unsummarized.slice(-this.options.keep);

    const userMessage = this.buildSummarizerInput(
      previousCore,
      previousContext,
      toSummarize,
    );

    const result = await this.agent.runStateless([
      { role: "user", content: userMessage },
    ]);

    const parsed = parseSummaryResponse(result.content);
    const lastSummarized = toSummarize[toSummarize.length - 1];

    return {
      messages: toKeep,
      core: parsed.core,
      context: parsed.context,
      summarizedUpTo: lastSummarized.id,
      dirty: true,
    };
  }

  private shouldSummarize(
    unsummarized: PersistedMessage[],
    lastUsage: RealContext["lastUsage"],
  ): boolean {
    if (this.options.strategy === "window") {
      return unsummarized.length >= this.options.every;
    }
    return lastUsage.totalTokens / lastUsage.maxTokens >= this.options.ratio;
  }

  private buildSummarizerInput(
    previousCore: string[],
    previousContext: string,
    messages: PersistedMessage[],
  ): string {
    const coreSection =
      previousCore.length > 0 ? previousCore.join("\n") : "None";
    const contextSection = previousContext || "None";
    const messagesSection = messages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    return `[Previous CORE]\n${coreSection}\n\n[Previous CONTEXT]\n${contextSection}\n\n[New Messages]\n${messagesSection}`;
  }
}

export function parseSummaryResponse(response: string): {
  core: string[];
  context: string;
} {
  const coreMatch = response.indexOf("[CORE]");
  const contextMatch = response.indexOf("[CONTEXT]");

  if (coreMatch === -1 || contextMatch === -1) {
    return { core: [], context: response.trim() };
  }

  const coreBlock = response.slice(coreMatch + "[CORE]".length, contextMatch);
  const contextBlock = response.slice(contextMatch + "[CONTEXT]".length);

  const core = coreBlock
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const context = contextBlock.trim();

  return { core, context };
}
