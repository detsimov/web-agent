import { Agent } from "@/lib/agent/Agent";
import {
  FACTS_EXTRACTION_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
} from "@/lib/context/constants";
import type { IChatRepository } from "@/lib/repository/types";
import type { Message } from "@/lib/types";
import { StickyFactsStrategy } from "./strategies/StickyFactsStrategy";
import { SummarizationStrategy } from "./strategies/SummarizationStrategy";
import type {
  BranchConfig,
  ContextStrategy,
  PipelineState,
  StreamChunk,
  UsageAccumulator,
} from "./types";

export class AgentPipeline {
  constructor(
    private repo: IChatRepository,
    private agent: Agent,
  ) {}

  async *send(
    branchId: number,
    content: string,
    overrides?: { model?: string; maxTokens?: number },
  ): AsyncGenerator<StreamChunk> {
    // 1. Prepare
    const branch = await this.repo.getBranch(branchId);
    const chat = await this.repo.getChat(branch.chatId);
    const allMessages = await this.repo.resolveMessages(branch);
    const contextState = await this.repo.loadContextState(branchId);
    const lastUsage = await this.repo.getLastUsage(branchId);

    const config = buildBranchConfig(branch, chat, lastUsage, overrides);

    // 2. Persist model choice if changed
    if (overrides?.model && overrides.model !== branch.model) {
      await this.repo.updateBranch(branchId, { model: overrides.model });
    }

    // 3. Initialize pipeline state
    let state: PipelineState = {
      messages: allMessages,
      facts: contextState.facts,
      context: contextState.context,
      cursors: {
        summarizedUpTo: contextState.summarizedUpTo,
        factsExtractedUpTo: contextState.factsExtractedUpTo,
      },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
    };

    // 4. Create and run strategies
    const strategies = this.createStrategies(config);
    state = await this.runStrategies(strategies, state, config);

    // 5. Apply sliding window (after strategies)
    let messagesToSend = state.messages;
    if (config.contextMode === "sliding-window") {
      messagesToSend = allMessages.slice(-config.slidingWindowSize);
    }

    // 6. Build final messages
    const finalMessages = buildFinalMessages(
      chat.systemMessage,
      state.facts,
      state.context,
      messagesToSend,
      content,
    );

    // 7. Configure agent for main response and stream
    const mainAgent = this.createMainAgent(config);
    let assistantContent = "";
    let agentUsage: UsageAccumulator | null = null;

    for await (const chunk of mainAgent.stream(finalMessages)) {
      yield chunk;
      if (chunk.type === "delta") assistantContent += chunk.content;
      if (chunk.type === "done") {
        assistantContent = chunk.content;
        agentUsage = chunk.usage;
      }
      if (chunk.type === "error") {
        return;
      }
    }

    // 8. Commit turn atomically
    const stateChanged =
      state.cursors.summarizedUpTo !== contextState.summarizedUpTo ||
      state.cursors.factsExtractedUpTo !== contextState.factsExtractedUpTo;

    await this.repo.commitTurn(branchId, {
      userContent: content,
      assistantContent,
      usage: mergeUsage(state.usage, agentUsage),
      contextState: stateChanged
        ? {
            facts: state.facts,
            context: state.context,
            summarizedUpTo: state.cursors.summarizedUpTo,
            factsExtractedUpTo: state.cursors.factsExtractedUpTo,
          }
        : null,
    });
  }

  private createStrategies(config: BranchConfig): ContextStrategy[] {
    const strategies: ContextStrategy[] = [];

    if (config.contextMode === "summarization") {
      const summarizationAgent = new Agent({
        model: config.summarizationModel ?? this.agent.config.model,
        maxTokens: 4096,
        instructions: SUMMARY_SYSTEM_PROMPT,
      });
      strategies.push(new SummarizationStrategy(summarizationAgent));
    }

    if (config.stickyFactsEnabled) {
      const factsAgent = new Agent({
        model: config.stickyFactsModel ?? this.agent.config.model,
        maxTokens: 4096,
        instructions: FACTS_EXTRACTION_PROMPT,
      });
      strategies.push(
        new StickyFactsStrategy(
          factsAgent,
          config.stickyFactsBaseKeys,
          config.stickyFactsRules,
        ),
      );
    }

    return strategies;
  }

  private async runStrategies(
    strategies: ContextStrategy[],
    state: PipelineState,
    config: BranchConfig,
  ): Promise<PipelineState> {
    for (const strategy of strategies) {
      const prevCursors = { ...state.cursors };
      try {
        const result = await strategy.run(state, config);
        if (result !== null) {
          assertCursorsMonotonic(prevCursors, result.cursors);
          state = result;
        }
      } catch (error) {
        console.warn("Strategy failed, skipping:", error);
      }
    }
    return state;
  }

  private createMainAgent(config: BranchConfig): Agent {
    return new Agent({
      model: this.agent.config.model,
      maxTokens: config.maxTokens,
      instructions: "", // system message is in finalMessages
    });
  }
}

function buildBranchConfig(
  branch: {
    contextMode: string;
    model: string | null;
    slidingWindowSize: number;
    stickyFactsEnabled: number;
    stickyFactsEvery: number;
    stickyFactsModel: string | null;
    summarizationTrigger: string | null;
    summarizationModel: string | null;
    summarizationEvery: number | null;
    summarizationRatio: number | null;
    summarizationKeep: number | null;
  },
  chat: {
    maxTokens: number;
    stickyFactsBaseKeys: string | null;
    stickyFactsRules: string | null;
  },
  lastUsage: { totalTokens: number },
  overrides?: { model?: string; maxTokens?: number },
): BranchConfig {
  return {
    contextMode: branch.contextMode as BranchConfig["contextMode"],
    slidingWindowSize: branch.slidingWindowSize,
    summarizationTrigger: (branch.summarizationTrigger ?? "window") as
      | "window"
      | "percentage",
    summarizationEvery: branch.summarizationEvery ?? 10,
    summarizationRatio: branch.summarizationRatio ?? 0.75,
    summarizationKeep: branch.summarizationKeep ?? 4,
    summarizationModel: branch.summarizationModel,
    stickyFactsEnabled: !!branch.stickyFactsEnabled,
    stickyFactsEvery: branch.stickyFactsEvery,
    stickyFactsModel: branch.stickyFactsModel,
    stickyFactsBaseKeys: chat.stickyFactsBaseKeys
      ? JSON.parse(chat.stickyFactsBaseKeys)
      : [],
    stickyFactsRules: chat.stickyFactsRules ?? "",
    lastTotalTokens: lastUsage.totalTokens,
    maxTokens: overrides?.maxTokens ?? chat.maxTokens,
  };
}

function buildFinalMessages(
  systemMessage: string,
  facts: Record<string, string>,
  context: string,
  messages: import("@/lib/types").PersistedMessage[],
  newUserMessage: string,
): Message[] {
  let system = systemMessage;
  const hasFacts = Object.keys(facts).length > 0;
  const hasContext = context.length > 0;

  if (hasFacts || hasContext) {
    system += "\n\n[CONVERSATION SUMMARY]";
    if (hasFacts) {
      const block = Object.entries(facts)
        .map(([k, v]) => `${k} = ${v}`)
        .join("\n");
      system += `\n[FACTS]\n${block}`;
    }
    if (hasContext) {
      system += `\n\n[CONTEXT]\n${context}`;
    }
  }

  return [
    { role: "system", content: system },
    ...messages.map((m) => ({
      role: m.role as Message["role"],
      content: m.content,
    })),
    { role: "user" as const, content: newUserMessage },
  ];
}

function assertCursorsMonotonic(
  prev: PipelineState["cursors"],
  next: PipelineState["cursors"],
): void {
  if (
    next.summarizedUpTo < prev.summarizedUpTo ||
    next.factsExtractedUpTo < prev.factsExtractedUpTo
  ) {
    throw new Error("Strategy cursor regression detected");
  }
}

function mergeUsage(
  pipeline: UsageAccumulator,
  agent: UsageAccumulator | null,
): UsageAccumulator | null {
  if (!agent && pipeline.totalTokens === 0) return null;
  if (!agent) return pipeline;
  if (pipeline.totalTokens === 0) return agent;
  return {
    inputTokens: pipeline.inputTokens + agent.inputTokens,
    outputTokens: pipeline.outputTokens + agent.outputTokens,
    totalTokens: pipeline.totalTokens + agent.totalTokens,
    cost: pipeline.cost + agent.cost,
  };
}
