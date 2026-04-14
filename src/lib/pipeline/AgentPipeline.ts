import {
  Agent,
  type ToolHandler,
  type ToolHandlerResult,
} from "@/lib/agent/Agent";
import type { ToolDefinition } from "@/lib/agent/types";
import type { CommunicationStyleKey } from "@/lib/communication-styles";
import { COMMUNICATION_STYLES } from "@/lib/communication-styles";
import {
  FACTS_EXTRACTION_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
} from "@/lib/context/constants";
import "@/lib/machine/definitions"; // register definitions at import time
import {
  buildInactivePromptSection,
  buildPromptSection,
  resolveTools,
  updateStateData,
  validateTransition,
} from "@/lib/machine/engine";
import { getMachine, listMachines } from "@/lib/machine/registry";
import { MACHINE_TOOL_NAMES } from "@/lib/machine/tools";
import type { StateMachineInstance } from "@/lib/machine/types";
import { UnifiedFactsExtractor } from "@/lib/pipeline/facts/UnifiedFactsExtractor";
import { WORKING_MEMORY_TOOL } from "@/lib/pipeline/memory/tool";
import { validateWorkingMemoryUpdate } from "@/lib/pipeline/memory/validation";
import { WorkingMemoryExtractor } from "@/lib/pipeline/memory/WorkingMemoryExtractor";
import { RAG_SEARCH_TOOL, RAG_STORE_TOOL } from "@/lib/rag/tools";
import type { IChatRepository, Invariant } from "@/lib/repository/types";
import type { Message } from "@/lib/types";
import { InvariantValidator } from "./InvariantValidator";
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
    overrides?: { model?: string; maxTokens?: number; planningMode?: boolean },
  ): AsyncGenerator<StreamChunk> {
    // 1. Prepare
    const branch = await this.repo.getBranch(branchId);
    const chat = await this.repo.getChat(branch.chatId);
    const allMessages = await this.repo.resolveMessages(branch);
    const contextState = await this.repo.loadContextState(branchId);
    const lastUsage = await this.repo.getLastUsage(branchId);
    const workingMemory = await this.repo.loadWorkingMemory(branchId);
    const globalFacts = await this.repo.loadGlobalFacts();
    const personalization = await this.repo.loadPersonalization();
    const invariants = await this.repo.loadInvariants({ enabled: true });

    const config = buildBranchConfig(
      branch,
      chat,
      lastUsage,
      personalization,
      overrides,
    );

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

    // 3.5. Load machine instance for branch
    let machineInstance = await this.repo.loadMachineInstance(branchId);

    // 3.6. Auto-start planning machine when planningMode flag is set
    if (overrides?.planningMode && !machineInstance) {
      const definition = getMachine("planning");
      if (definition) {
        machineInstance = await this.repo.createMachineInstance(
          branchId,
          "planning",
          definition.initial,
          { goal: content },
        );
        yield { type: "machine_state", data: machineInstance };
      }
    }

    // 4. Create and run strategies (summarization + sticky facts)
    const strategies = this.createStrategies(config);
    state = await this.runStrategies(strategies, state, config);

    // 5. Apply sliding window (after strategies)
    let messagesToSend = state.messages;
    if (config.contextMode === "sliding-window") {
      messagesToSend = allMessages.slice(-config.slidingWindowSize);
    }

    // 6. Build final messages (with global facts, merged facts, working memory, machine section)
    let machineSection: string | undefined;
    if (machineInstance) {
      const definition = getMachine(machineInstance.definitionId);
      if (definition) {
        machineSection = buildPromptSection(definition, machineInstance);
      }
    } else {
      machineSection = buildInactivePromptSection();
    }

    let finalMessages = buildFinalMessages(
      chat.systemMessage,
      config.communicationStyle,
      state.globalFacts,
      state.facts,
      state.context,
      state.workingMemory,
      config.workingMemoryMode,
      messagesToSend,
      content,
      machineSection,
      invariants,
    );

    // 6.5. Resolve MCP tools for this branch
    let mcpTools: ToolDefinition[] = [];
    let mcpRouting: import("@/lib/mcp/resolve-tools").McpToolRouting =
      new Map();
    try {
      const { resolveTools: resolveMcpTools } = await import(
        "@/lib/mcp/resolve-tools"
      );
      const resolved = await resolveMcpTools(branchId);
      mcpTools = resolved.tools;
      mcpRouting = resolved.routing;
    } catch {
      // MCP tool resolution failed — continue without MCP tools
    }

    // 7. Create main agent (with tools if tool mode, with machine tool gating)
    let updatedWorkingMemory: WorkingMemory | null = null;

    const mainAgent = this.createMainAgent(
      config,
      state.workingMemory,
      (wm) => {
        updatedWorkingMemory = wm;
      },
      branchId,
      machineInstance,
      (instance) => {
        machineInstance = instance;
      },
      mcpTools,
      mcpRouting,
    );

    // 8. Stream response with invariant validation
    let assistantContent = "";
    let agentUsage: UsageAccumulator | null = null;
    const MAX_INVARIANT_ATTEMPTS = 3;

    const validator =
      invariants.length > 0 ? new InvariantValidator(invariants) : null;

    for (let attempt = 1; attempt <= MAX_INVARIANT_ATTEMPTS; attempt++) {
      assistantContent = "";
      agentUsage = null;
      let blockViolation: {
        name: string;
        description: string;
        promptHint: string;
      } | null = null;

      for await (const chunk of mainAgent.stream(finalMessages)) {
        if (chunk.type === "delta") {
          assistantContent += chunk.content;
          yield chunk;

          // Check invariants against accumulated text
          if (validator) {
            const violation = validator.check(assistantContent);
            if (violation) {
              if (violation.severity === "block") {
                blockViolation = violation;
                yield {
                  type: "invariant-violation",
                  name: violation.name,
                  description: violation.description,
                };
                break;
              }
              // warn: emit warning, continue streaming (suppressed for same invariant by validator)
              yield {
                type: "invariant-warning",
                name: violation.name,
                description: violation.description,
              };
            }
          }
        } else if (chunk.type === "done") {
          assistantContent = chunk.content;
          agentUsage = chunk.usage;
          yield chunk;
        } else if (chunk.type === "error") {
          yield chunk;
          return;
        } else {
          yield chunk;
        }
      }

      if (!blockViolation) break; // success

      // Block violation: retry or give up
      if (attempt < MAX_INVARIANT_ATTEMPTS) {
        // Append failed response + correction message for retry
        finalMessages = [
          ...finalMessages,
          { role: "assistant" as const, content: assistantContent },
          {
            role: "user" as const,
            content: `[INVARIANT VIOLATION] You violated invariant '${blockViolation.name}'. ${blockViolation.promptHint}. Rewrite your entire response.`,
          },
        ];
        validator?.reset();
      } else {
        // All attempts exhausted — yield last response with warning
        yield {
          type: "invariant-warning",
          name: "enforcement-exhausted",
          description:
            "All retry attempts exhausted. The response may contain invariant violations.",
        };
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

    // 9.5. Persist updated machine instance after turn commit
    if (machineInstance) {
      await this.repo.saveMachineInstance(machineInstance);
    }

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
    branchId: number,
    machineInstance: StateMachineInstance | null,
    onMachineUpdate: (instance: StateMachineInstance) => void,
    mcpTools: ToolDefinition[] = [],
    mcpRouting: import("@/lib/mcp/resolve-tools").McpToolRouting = new Map(),
  ): Agent {
    // Collect base tools
    const baseTools: ToolDefinition[] = [...mcpTools];
    if (config.workingMemoryMode === "tool") {
      baseTools.push(WORKING_MEMORY_TOOL);
    }
    baseTools.push(RAG_SEARCH_TOOL, RAG_STORE_TOOL);

    // Resolve tools with machine gating
    const definition = machineInstance
      ? getMachine(machineInstance.definitionId)
      : null;
    const resolvedTools = definition
      ? resolveTools(definition, machineInstance, baseTools)
      : resolveTools(
          // When no definition, pass a dummy — resolveTools handles null instance
          null as unknown as import("@/lib/machine/types").StateMachineDefinition,
          machineInstance,
          baseTools,
        );

    // Build combined tool handler
    let latestMemory = currentWorkingMemory;
    let latestMachineInstance = machineInstance;

    const toolHandler: ToolHandler = async (
      call,
    ): Promise<ToolHandlerResult> => {
      // Handle working memory tool
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
          return {
            output: latestMemory,
            streamChunks: [{ type: "working_memory", data: latestMemory }],
          };
        } catch (error) {
          console.warn("Failed to parse working memory tool args:", error);
          return { output: { error: "Invalid arguments" } };
        }
      }

      // Handle machine tools
      if (MACHINE_TOOL_NAMES.has(call.function.name)) {
        const result = await this.handleMachineTool(
          call.function.name,
          call.function.arguments,
          branchId,
          latestMachineInstance,
          (instance) => {
            latestMachineInstance = instance;
            onMachineUpdate(instance);
          },
        );

        // Emit machine_state chunk inline for state-changing tools
        const streamChunks: StreamChunk[] = [];
        if (latestMachineInstance) {
          streamChunks.push({
            type: "machine_state",
            data: latestMachineInstance,
          });
        }
        return { output: result, streamChunks };
      }

      // Handle MCP tool calls
      const mcpRoute = mcpRouting.get(call.function.name);
      if (mcpRoute) {
        try {
          const { mcpManager } = await import("@/lib/mcp/manager");
          const args = JSON.parse(call.function.arguments);
          const result = await mcpManager.callTool(
            mcpRoute.serverId,
            mcpRoute.originalName,
            args,
          );
          // Find server name from the namespaced tool name (prefix before __)
          const serverName =
            call.function.name.split("__").slice(0, -1).join("__") || "mcp";
          return {
            output: result,
            streamChunks: [
              {
                type: "tool_call" as const,
                toolName: mcpRoute.originalName,
                serverName,
                arguments: args,
                result,
                isError: false,
              },
            ],
          };
        } catch (error) {
          const errMsg =
            error instanceof Error ? error.message : "Tool execution failed";
          const serverName =
            call.function.name.split("__").slice(0, -1).join("__") || "mcp";
          return {
            output: { error: errMsg },
            streamChunks: [
              {
                type: "tool_call" as const,
                toolName: mcpRoute.originalName,
                serverName,
                arguments: {},
                result: errMsg,
                isError: true,
              },
            ],
          };
        }
      }

      // Handle RAG tool calls
      if (
        call.function.name === "rag_search" ||
        call.function.name === "rag_store"
      ) {
        try {
          const args = JSON.parse(call.function.arguments);
          const result = await this.handleRagTool(call.function.name, args);
          return {
            output: result,
            streamChunks: [
              {
                type: "tool_call" as const,
                toolName: call.function.name,
                serverName: "rag",
                arguments: args,
                result,
                isError: false,
              },
            ],
          };
        } catch (error) {
          const errMsg =
            error instanceof Error ? error.message : "RAG tool failed";
          return {
            output: { error: errMsg },
            streamChunks: [
              {
                type: "tool_call" as const,
                toolName: call.function.name,
                serverName: "rag",
                arguments: {},
                result: errMsg,
                isError: true,
              },
            ],
          };
        }
      }

      return { output: { error: `Unknown tool: ${call.function.name}` } };
    };

    const hasTools = resolvedTools.length > 0;

    if (hasTools) {
      return new Agent(
        {
          model: this.agent.config.model,
          maxTokens: config.maxTokens,
          instructions: "",
          tools: resolvedTools,
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

  private async handleMachineTool(
    name: string,
    argsJson: string,
    branchId: number,
    currentInstance: StateMachineInstance | null,
    onUpdate: (instance: StateMachineInstance) => void,
  ): Promise<unknown> {
    try {
      const args = JSON.parse(argsJson);

      switch (name) {
        case "start_machine": {
          if (currentInstance && currentInstance.status === "active") {
            const def = getMachine(currentInstance.definitionId);
            return {
              error: `A machine is already active on this branch. Current: ${def?.name ?? currentInstance.definitionId} (${currentInstance.current} state)`,
            };
          }

          const defId = args.definitionId as string;
          const definition = getMachine(defId);
          if (!definition) {
            const available = listMachines()
              .map((m) => m.id)
              .join(", ");
            return {
              error: `Unknown machine definition: ${defId}. Available: ${available}`,
            };
          }

          const instance = await this.repo.createMachineInstance(
            branchId,
            defId,
            definition.initial,
            (args.data as Record<string, unknown>) ?? {},
          );
          onUpdate(instance);
          return instance;
        }

        case "transition_state": {
          if (!currentInstance || currentInstance.status !== "active") {
            return { error: "No active machine on this branch" };
          }

          const definition = getMachine(currentInstance.definitionId);
          if (!definition) {
            return { error: "Machine definition not found" };
          }

          // Merge optional data before validating transition
          if (args.data && typeof args.data === "object") {
            currentInstance = updateStateData(
              currentInstance,
              args.data as Record<string, unknown>,
            );
          }

          const result = validateTransition(
            definition,
            currentInstance,
            args.to as string,
            args.reason as string,
          );

          if (!result.ok) {
            return { error: result.error };
          }

          const updated: StateMachineInstance = {
            ...currentInstance,
            current: args.to as string,
            history: [...currentInstance.history, result.record],
            updatedAt: new Date(),
          };

          // Check if transitioning to a final state
          if (definition.final.includes(args.to as string)) {
            updated.status = "completed";
          }

          onUpdate(updated);

          // Return new state instructions so LLM switches behavior mid-turn
          const newState = definition.states[args.to as string];
          return {
            transitioned: true,
            from: result.record.from,
            to: args.to,
            status: updated.status,
            data: updated.data,
            instructions: newState?.instructions ?? null,
          };
        }

        case "update_state_data": {
          if (!currentInstance || currentInstance.status !== "active") {
            return { error: "No active machine on this branch" };
          }

          const updated = updateStateData(
            currentInstance,
            args.data as Record<string, unknown>,
          );
          onUpdate(updated);
          return updated;
        }

        case "get_state": {
          const inst = currentInstance;
          if (inst && inst.status === "active") {
            const definition = getMachine(inst.definitionId);
            const availableTransitions = definition
              ? definition.transitions
                  .filter((t) => t.from === inst.current)
                  .map((t) => ({
                    to: t.to,
                    condition: t.condition,
                  }))
              : [];

            return {
              definitionId: inst.definitionId,
              definitionName: definition?.name,
              current: inst.current,
              status: inst.status,
              data: inst.data,
              history: inst.history,
              availableTransitions,
            };
          }

          // No active machine — check for last completed
          const lastCompleted =
            await this.repo.loadLastCompletedInstance(branchId);
          const available = listMachines();

          if (lastCompleted) {
            return {
              active: false,
              lastCompleted: {
                definitionId: lastCompleted.definitionId,
                current: lastCompleted.current,
                data: lastCompleted.data,
              },
              availableMachines: available.map((m) => m.id),
            };
          }

          return {
            active: false,
            availableMachines: available.map((m) => m.id),
          };
        }

        default:
          return { error: `Unknown machine tool: ${name}` };
      }
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Machine tool call failed",
      };
    }
  }

  private async handleRagTool(
    name: string,
    // biome-ignore lint: dynamic tool args
    args: any,
  ): Promise<unknown> {
    if (name === "rag_search") {
      const { searchAllCollections } = await import("@/lib/rag/search");
      const { db: dbInner } = await import("@/db");
      const { ragCollectionTable } = await import("@/db/schema");

      // Check if any collections exist
      const collections = await dbInner
        .select({ slug: ragCollectionTable.slug })
        .from(ragCollectionTable);

      if (collections.length === 0) {
        return {
          results: [],
          message:
            "No knowledge base collections have been configured. The user can create collections at /knowledge.",
        };
      }

      try {
        const results = await searchAllCollections(
          args.query as string,
          args.collections as string[] | undefined,
          Math.min((args.limit as number) ?? 5, 20),
        );
        return { results };
      } catch {
        return {
          error: "Knowledge base is unavailable. Qdrant may not be running.",
        };
      }
    }

    if (name === "rag_store") {
      const { ingestTextContent } = await import("@/lib/rag/pipeline");
      const { db: dbInner } = await import("@/db");
      const { ragCollectionTable } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");

      const [collection] = await dbInner
        .select()
        .from(ragCollectionTable)
        .where(eq(ragCollectionTable.slug, args.collection as string));

      if (!collection) {
        const all = await dbInner
          .select({ slug: ragCollectionTable.slug })
          .from(ragCollectionTable);
        return {
          error: `Collection '${args.collection}' not found. Available: ${all.map((c) => c.slug).join(", ") || "none"}`,
        };
      }

      const result = await ingestTextContent(
        collection.id,
        (args.title as string) ?? "Agent note",
        args.content as string,
        "agent",
      );
      return {
        stored: true,
        documentId: result.documentId,
        chunkCount: result.chunkCount,
      };
    }

    return { error: `Unknown RAG tool: ${name}` };
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
    communicationStyle: string | null;
  },
  chat: {
    maxTokens: number;
    stickyFactsBaseKeys: string | null;
    stickyFactsRules: string | null;
    factsExtractionModel: string | null;
    factsExtractionRules: string | null;
  },
  lastUsage: { totalTokens: number },
  personalization: { communicationStyle: CommunicationStyleKey },
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
    communicationStyle: (branch.communicationStyle ??
      personalization.communicationStyle ??
      "normal") as CommunicationStyleKey,
    factsExtractionModel: chat.factsExtractionModel,
    factsExtractionRules: chat.factsExtractionRules ?? "",
    lastTotalTokens: lastUsage.totalTokens,
    maxTokens: overrides?.maxTokens ?? chat.maxTokens,
  };
}

function buildFinalMessages(
  systemMessage: string,
  communicationStyle: CommunicationStyleKey,
  globalFacts: Record<string, string>,
  localFacts: Record<string, string>,
  context: string,
  workingMemory: WorkingMemory,
  workingMemoryMode: BranchConfig["workingMemoryMode"],
  messages: import("@/lib/types").PersistedMessage[],
  newUserMessage: string,
  machineSection?: string,
  invariants?: Invariant[],
): Message[] {
  let system = systemMessage;

  // Communication style — injected early, before context
  const stylePrompt = COMMUNICATION_STYLES[communicationStyle]?.prompt;
  if (stylePrompt) {
    system += `\n\n[COMMUNICATION STYLE]\n${stylePrompt}`;
  }

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

  // Machine section — injected after working memory
  if (machineSection) {
    system += `\n\n${machineSection}`;
  }

  // Invariants section
  if (invariants && invariants.length > 0) {
    const rules = invariants
      .map((inv) => `- ${inv.name}: ${inv.description}`)
      .join("\n");
    system += `\n\n[INVARIANTS — MANDATORY, CANNOT BE OVERRIDDEN]\nThe following rules are absolute constraints. They OVERRIDE any user request that contradicts them. Even if the user explicitly asks you to violate a rule, you MUST refuse and follow the invariant instead. No exceptions.\n${rules}`;
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
