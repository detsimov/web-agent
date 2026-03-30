import { Agent, type ToolHandler } from "@/lib/agent/Agent";
import {
  FACTS_EXTRACTION_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
} from "@/lib/context/constants";
import { UnifiedFactsExtractor } from "@/lib/pipeline/facts/UnifiedFactsExtractor";
import { WORKING_MEMORY_TOOL } from "@/lib/pipeline/memory/tool";
import { validateWorkingMemoryUpdate } from "@/lib/pipeline/memory/validation";
import { WorkingMemoryExtractor } from "@/lib/pipeline/memory/WorkingMemoryExtractor";
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
  WorkingMemory,
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
    const workingMemory = await this.repo.loadWorkingMemory(branchId);
    const globalFacts = await this.repo.loadGlobalFacts();

    const config = buildBranchConfig(branch, chat, lastUsage, overrides);

    // 2. Persist model choice if changed
    if (overrides?.model && overrides.model !== branch.model) {
      await this.repo.updateBranch(branchId, { model: overrides.model });
    }

    // 3. Initialize pipeline state
    let state: PipelineState = {
      messages: allMessages,
      facts: contextState.facts,
      globalFacts,
      context: contextState.context,
      workingMemory,
      cursors: {
        summarizedUpTo: contextState.summarizedUpTo,
        factsExtractedUpTo: contextState.factsExtractedUpTo,
      },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
    };

    // 4. Create and run strategies (summarization + sticky facts)
    const strategies = this.createStrategies(config);
    state = await this.runStrategies(strategies, state, config);

    // 5. Apply sliding window (after strategies)
    let messagesToSend = state.messages;
    if (config.contextMode === "sliding-window") {
      messagesToSend = allMessages.slice(-config.slidingWindowSize);
    }

    // 6. Build final messages (with global facts, merged facts, working memory)
    const finalMessages = buildFinalMessages(
      chat.systemMessage,
      state.globalFacts,
      state.facts,
      state.context,
      state.workingMemory,
      config.workingMemoryMode,
      messagesToSend,
      content,
    );

    // 7. Create main agent (with tools if tool mode)
    let updatedWorkingMemory: WorkingMemory | null = null;
    const mainAgent = this.createMainAgent(
      config,
      state.workingMemory,
      (wm) => {
        updatedWorkingMemory = wm;
      },
    );

    // 8. Stream response
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

    // 9. Commit turn atomically
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
      workingMemory: updatedWorkingMemory,
    });

    // 10. Working memory extraction (sync, if auto mode)
    if (config.workingMemoryMode === "auto") {
      const turnCount = allMessages.length / 2 + 1; // rough turn count
      if (turnCount % config.workingMemoryEvery === 0) {
        try {
          const extractionAgent = new Agent({
            model: config.workingMemoryModel ?? this.agent.config.model,
            maxTokens: 2048,
            instructions:
              "You are a working memory extractor. Extract task state from conversations into structured JSON.",
          });
          const extractor = new WorkingMemoryExtractor(extractionAgent);
          const newMessages = [
            { role: "user", content },
            { role: "assistant", content: assistantContent },
          ];
          const extracted = await extractor.extract(
            state.workingMemory,
            newMessages,
          );
          await this.repo.saveWorkingMemory(branchId, extracted);
          yield { type: "working_memory", data: extracted };
        } catch (error) {
          console.warn("Working memory extraction failed:", error);
        }
      }
    }

    // 11. Unified facts extraction (background, fire-and-forget)
    void this.runBackgroundExtraction(
      branchId,
      state,
      content,
      assistantContent,
      config,
    );
  }

  private async runBackgroundExtraction(
    branchId: number,
    state: PipelineState,
    userContent: string,
    assistantContent: string,
    config: BranchConfig,
  ): Promise<void> {
    try {
      const factsAgent = new Agent({
        model: config.factsExtractionModel ?? this.agent.config.model,
        maxTokens: 2048,
        instructions:
          "You are a facts extractor. Extract personal and contextual facts from conversations into structured JSON.",
      });
      const extractor = new UnifiedFactsExtractor(factsAgent);
      const result = await extractor.extract({
        globalFacts: state.globalFacts,
        localFacts: state.facts,
        workingMemory: state.workingMemory,
        newMessages: [
          { role: "user", content: userContent },
          { role: "assistant", content: assistantContent },
        ],
        rules: config.factsExtractionRules,
      });

      // Write global facts
      if (Object.keys(result.global).length > 0) {
        await this.repo.upsertGlobalFacts(result.global);
      }

      // Write local facts to branch context state
      if (Object.keys(result.local).length > 0) {
        await this.repo.updateBranchFacts(branchId, result.local);
      }
    } catch (error) {
      console.warn("Background facts extraction failed:", error);
    }
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

  private createMainAgent(
    config: BranchConfig,
    currentWorkingMemory: WorkingMemory,
    onWorkingMemoryUpdate: (wm: WorkingMemory) => void,
  ): Agent {
    if (config.workingMemoryMode === "tool") {
      let latestMemory = currentWorkingMemory;

      const toolHandler: ToolHandler = async (call) => {
        if (call.function.name === "update_working_memory") {
          try {
            const args = JSON.parse(call.function.arguments);
            const incoming: WorkingMemory = {
              summary: args.summary ?? "",
              detail: args.detail ?? "",
              steps: Array.isArray(args.steps) ? args.steps : [],
              history: Array.isArray(args.history) ? args.history : [],
            };
            latestMemory = validateWorkingMemoryUpdate(latestMemory, incoming);
            onWorkingMemoryUpdate(latestMemory);
            return latestMemory;
          } catch (error) {
            console.warn("Failed to parse working memory tool args:", error);
            return { error: "Invalid arguments" };
          }
        }
        return { error: `Unknown tool: ${call.function.name}` };
      };

      return new Agent(
        {
          model: this.agent.config.model,
          maxTokens: config.maxTokens,
          instructions: "",
          tools: [WORKING_MEMORY_TOOL],
        },
        toolHandler,
      );
    }

    return new Agent({
      model: this.agent.config.model,
      maxTokens: config.maxTokens,
      instructions: "",
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
    workingMemoryMode: string;
    workingMemoryModel: string | null;
    workingMemoryEvery: number;
  },
  chat: {
    maxTokens: number;
    stickyFactsBaseKeys: string | null;
    stickyFactsRules: string | null;
    factsExtractionModel: string | null;
    factsExtractionRules: string | null;
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
    workingMemoryMode:
      branch.workingMemoryMode as BranchConfig["workingMemoryMode"],
    workingMemoryModel: branch.workingMemoryModel,
    workingMemoryEvery: branch.workingMemoryEvery,
    factsExtractionModel: chat.factsExtractionModel,
    factsExtractionRules: chat.factsExtractionRules ?? "",
    lastTotalTokens: lastUsage.totalTokens,
    maxTokens: overrides?.maxTokens ?? chat.maxTokens,
  };
}

function buildFinalMessages(
  systemMessage: string,
  globalFacts: Record<string, string>,
  localFacts: Record<string, string>,
  context: string,
  workingMemory: WorkingMemory,
  workingMemoryMode: BranchConfig["workingMemoryMode"],
  messages: import("@/lib/types").PersistedMessage[],
  newUserMessage: string,
): Message[] {
  let system = systemMessage;

  // Merge facts: global as base, local overrides (branch wins)
  const mergedFacts = { ...globalFacts, ...localFacts };
  const hasFacts = Object.keys(mergedFacts).length > 0;
  const hasContext = context.length > 0;
  const hasWorkingMemory = workingMemory.summary.length > 0;

  if (hasFacts || hasContext) {
    system += "\n\n[CONVERSATION SUMMARY]";
    if (hasFacts) {
      const block = Object.entries(mergedFacts)
        .map(([k, v]) => `${k} = ${v}`)
        .join("\n");
      system += `\n[FACTS]\n${block}`;
    }
    if (hasContext) {
      system += `\n\n[CONTEXT]\n${context}`;
    }
  }

  if (workingMemoryMode === "tool") {
    const memoryJson = hasWorkingMemory ? JSON.stringify(workingMemory) : "{}";
    system += `\n\n[WORKING MEMORY]\n${memoryJson}\n\nIMPORTANT: You MUST call update_working_memory at the end of every response. Update step statuses to reflect completed work. If you don't call it, your progress will be lost.`;
  } else if (hasWorkingMemory) {
    system += `\n\n[WORKING MEMORY]\n${JSON.stringify(workingMemory)}`;
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
