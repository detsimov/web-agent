"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BranchTab } from "@/components/chat/BranchTabs";
import { BranchTabs } from "@/components/chat/BranchTabs";
import type {
  BranchConfig,
  BranchContextState,
} from "@/components/settings/BranchSettings";
import { ChatSidebar } from "@/components/sidebar/ChatSidebar";
import { ContextStateDialog } from "@/components/ui/ContextStateDialog";
import { Header } from "@/components/ui/Header";
import { MachineStateWidget } from "@/components/ui/MachineStateWidget";
import { SettingsDialog } from "@/components/ui/SettingsDialog";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { WorkingMemoryWidget } from "@/components/ui/WorkingMemoryWidget";
import { useChat } from "@/hooks/useChat";
import { useModels } from "@/hooks/useModels";
import { DEFAULT_INSTRUCTIONS } from "@/lib/agent/constants";
import type { CommunicationStyleKey } from "@/lib/communication-styles";
import type { ChatMessage } from "@/lib/types";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";

const DEFAULT_MODEL = "openrouter/auto";
const DEFAULT_MAX_TOKENS = 8192;

type ApiBranch = {
  id: number;
  name: string;
  parentBranchId: number | null;
  forkedAtMsgId: number | null;
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
  messages: Array<{
    id: number;
    role: string;
    content: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cost: number | null;
    } | null;
  }>;
  contextState: BranchContextState | null;
};

function makeDefaultBranch(branchId: number): ApiBranch {
  return {
    id: branchId,
    name: "main",
    parentBranchId: null,
    forkedAtMsgId: null,
    contextMode: "none",
    model: null,
    slidingWindowSize: 20,
    stickyFactsEnabled: 0,
    stickyFactsEvery: 1,
    stickyFactsModel: null,
    summarizationTrigger: null,
    summarizationModel: null,
    summarizationEvery: null,
    summarizationRatio: null,
    summarizationKeep: null,
    workingMemoryMode: "off",
    workingMemoryModel: null,
    workingMemoryEvery: 1,
    communicationStyle: null,
    messages: [],
    contextState: null,
  };
}

export function ChatContainer() {
  return (
    <ToastProvider>
      <ChatContainerInner />
    </ToastProvider>
  );
}

function ChatContainerInner() {
  const { showToast } = useToast();
  const {
    models,
    isLoading: modelsLoading,
    refetch: refetchModels,
  } = useModels();
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [maxTokens, setMaxTokens] = useState(DEFAULT_MAX_TOKENS);
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    "general" | "mcp" | "context" | "profile" | "invariants" | undefined
  >(undefined);
  const [contextStateOpen, setContextStateOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);
  const [branches, setBranches] = useState<ApiBranch[]>([]);
  const [factsExtractionModel, setFactsExtractionModel] = useState<
    string | null
  >(null);
  const [factsExtractionRules, setFactsExtractionRules] = useState<
    string | null
  >(null);
  const [globalStyle, setGlobalStyle] =
    useState<CommunicationStyleKey>("normal");

  useEffect(() => {
    fetch("/api/personalization")
      .then((r) => r.json())
      .then((data) => {
        setGlobalStyle(data.communicationStyle);
      });
  }, []);

  const selectedModelData = useMemo(
    () => models.find((m) => m.id === selectedModel),
    [models, selectedModel],
  );

  const maxTokensLimit = selectedModelData?.context_length ?? 200_000;

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === activeBranchId),
    [branches, activeBranchId],
  );

  const branchConfig: BranchConfig | null = activeBranch
    ? {
        contextMode: activeBranch.contextMode,
        model: activeBranch.model,
        slidingWindowSize: activeBranch.slidingWindowSize,
        stickyFactsEnabled: activeBranch.stickyFactsEnabled,
        stickyFactsEvery: activeBranch.stickyFactsEvery,
        stickyFactsModel: activeBranch.stickyFactsModel,
        summarizationTrigger: activeBranch.summarizationTrigger,
        summarizationModel: activeBranch.summarizationModel,
        summarizationEvery: activeBranch.summarizationEvery,
        summarizationRatio: activeBranch.summarizationRatio,
        summarizationKeep: activeBranch.summarizationKeep,
        workingMemoryMode: activeBranch.workingMemoryMode,
        workingMemoryModel: activeBranch.workingMemoryModel,
        workingMemoryEvery: activeBranch.workingMemoryEvery,
      }
    : null;

  const branchContextState: BranchContextState | null =
    activeBranch?.contextState ?? null;

  const branchTabs: BranchTab[] = useMemo(
    () =>
      branches.map((b) => ({
        id: b.id,
        name: b.name,
        parentBranchId: b.parentBranchId,
      })),
    [branches],
  );

  const forkedAtMsgId = activeBranch?.forkedAtMsgId ?? null;

  const {
    messages,
    isLoading,
    error,
    clearError,
    workingMemory,
    setWorkingMemory,
    machineState,
    setMachineState,
    sendMessage,
    retryLastSend,
    abort: _abort,
    reset,
    loadMessages,
    removeMessage,
    restoreMessage,
  } = useChat({
    model: selectedModel,
    maxTokens,
    instructions,
    chatId: activeChatId,
    branchId: activeBranchId,
  });

  const retryLastSendRef = useRef(retryLastSend);
  useEffect(() => {
    retryLastSendRef.current = retryLastSend;
  }, [retryLastSend]);

  useEffect(() => {
    if (error?.kind !== "local-unreachable") return;
    showToast({
      message: `Local model unreachable: ${error.original}`,
      duration: 8000,
      actions: [
        {
          label: "Retry",
          onClick: () => {
            clearError();
            retryLastSendRef.current?.();
          },
        },
        {
          label: "Switch to cloud",
          onClick: () => {
            clearError();
            setSelectedModel(DEFAULT_MODEL);
            // Run after the model state has propagated to useChat's closure
            queueMicrotask(() => retryLastSendRef.current?.());
          },
        },
      ],
    });
  }, [error, showToast, clearError]);

  const loadBranchMessages = useCallback(
    (branch: ApiBranch, allBranches: ApiBranch[]) => {
      let msgs: ChatMessage[];
      if (branch.parentBranchId && branch.forkedAtMsgId) {
        const mainBranch = allBranches.find((b) => !b.parentBranchId);
        const parentMsgs = mainBranch
          ? mainBranch.messages
              .filter((m) => m.id <= (branch.forkedAtMsgId as number))
              .map(toDisplayMessage)
          : [];
        const ownMsgs = branch.messages.map(toDisplayMessage);
        msgs = [...parentMsgs, ...ownMsgs];
      } else {
        msgs = branch.messages.map(toDisplayMessage);
      }
      loadMessages(msgs);
    },
    [loadMessages],
  );

  const handleSelectChat = useCallback(
    async (chatId: number) => {
      setActiveChatId(chatId);
      const res = await fetch(`/api/chats/${chatId}`);
      if (res.ok) {
        const data = await res.json();
        const apiBranches: ApiBranch[] = data.chat.branches;
        setBranches(apiBranches);
        setFactsExtractionModel(data.chat.factsExtractionModel ?? null);
        setFactsExtractionRules(data.chat.factsExtractionRules ?? null);

        const mainBranch = apiBranches.find((b) => !b.parentBranchId);
        if (mainBranch) {
          setActiveBranchId(mainBranch.id);
          if (mainBranch.model) {
            setSelectedModel(mainBranch.model);
          }
          loadBranchMessages(mainBranch, apiBranches);
        }
      }
    },
    [loadBranchMessages],
  );

  const handleNewChat = useCallback(async () => {
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New Chat",
        maxTokens,
        systemMessage: instructions,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const mainBranchId = data.chat.mainBranchId;
      setActiveChatId(data.chat.id);
      setActiveBranchId(mainBranchId);
      setBranches([makeDefaultBranch(mainBranchId)]);
      reset();
      setSidebarRefresh((n) => n + 1);
    }
  }, [reset, maxTokens, instructions]);

  const handleDeleteChat = useCallback(
    (chatId: number) => {
      if (chatId === activeChatId) {
        setActiveChatId(null);
        setActiveBranchId(null);
        setBranches([]);
        reset();
      }
    },
    [activeChatId, reset],
  );

  const [_pendingDeletes, setPendingDeletes] = useState<
    Array<{
      messageId: number;
      snapshot: ChatMessage;
      index: number;
      timerId: ReturnType<typeof setTimeout>;
    }>
  >([]);

  const handleDeleteMessage = useCallback(
    (messageId: number) => {
      if (!activeChatId || !activeBranchId) return;

      const index = messages.findIndex((m) => m.id === messageId);
      if (index === -1) return;
      const snapshot = messages[index];

      removeMessage(messageId);

      const timerId = setTimeout(() => {
        fetch(
          `/api/chats/${activeChatId}/messages/${messageId}?branchId=${activeBranchId}`,
          { method: "DELETE" },
        );
        setPendingDeletes((prev) =>
          prev.filter((d) => d.messageId !== messageId),
        );
      }, 5000);

      setPendingDeletes((prev) => [
        ...prev,
        { messageId, snapshot, index, timerId },
      ]);

      showToast({
        message: "Message deleted",
        action: {
          label: "Undo",
          onClick: () => {
            clearTimeout(timerId);
            restoreMessage(snapshot, index);
            setPendingDeletes((prev) =>
              prev.filter((d) => d.messageId !== messageId),
            );
          },
        },
      });
    },
    [
      activeChatId,
      activeBranchId,
      messages,
      removeMessage,
      showToast,
      restoreMessage,
    ],
  );

  const refreshBranches = useCallback(async () => {
    if (!activeChatId) return;
    const res = await fetch(`/api/chats/${activeChatId}`);
    if (res.ok) {
      const data = await res.json();
      setBranches(data.chat.branches as ApiBranch[]);
    }
  }, [activeChatId]);

  const handleSend = useCallback(
    async (content: string, options?: { planningMode?: boolean }) => {
      await sendMessage(content, options);
      setSidebarRefresh((n) => n + 1);
      await refreshBranches();
    },
    [sendMessage, refreshBranches],
  );

  const handleSwitchBranch = useCallback(
    (branchId: number) => {
      const branch = branches.find((b) => b.id === branchId);
      if (branch) {
        setActiveBranchId(branchId);
        if (branch.model) {
          setSelectedModel(branch.model);
        }
        loadBranchMessages(branch, branches);
      }
    },
    [branches, loadBranchMessages],
  );

  const handleCreateFork = useCallback(async () => {
    if (!activeChatId) return;
    const mainBranch = branches.find((b) => !b.parentBranchId);
    if (!mainBranch || mainBranch.messages.length === 0) return;

    const lastMsg = mainBranch.messages[mainBranch.messages.length - 1];
    const name = prompt("Branch name:");
    if (!name?.trim()) return;

    const res = await fetch(`/api/chats/${activeChatId}/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), forkedAtMsgId: lastMsg.id }),
    });
    if (res.ok) {
      const data = await res.json();
      const newBranchId = data.branch.id;
      await handleSelectChat(activeChatId);
      setActiveBranchId(newBranchId);
    }
  }, [activeChatId, branches, handleSelectChat]);

  const handleForkFromMessage = useCallback(
    async (messageId: number) => {
      if (!activeChatId) return;
      const name = prompt("Branch name:");
      if (!name?.trim()) return;

      const res = await fetch(`/api/chats/${activeChatId}/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), forkedAtMsgId: messageId }),
      });
      if (res.ok) {
        const data = await res.json();
        const newBranchId = data.branch.id;
        await handleSelectChat(activeChatId);
        setActiveBranchId(newBranchId);
      }
    },
    [activeChatId, handleSelectChat],
  );

  const handleDeleteBranch = useCallback(
    async (branchId: number) => {
      if (!confirm("Delete this branch?")) return;
      const res = await fetch(`/api/branches/${branchId}`, {
        method: "DELETE",
      });
      if (res.ok && activeChatId) {
        await handleSelectChat(activeChatId);
      }
    },
    [activeChatId, handleSelectChat],
  );

  const handleRenameBranch = useCallback(
    async (branchId: number, name: string) => {
      await fetch(`/api/branches/${branchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setBranches((prev) =>
        prev.map((b) => (b.id === branchId ? { ...b, name } : b)),
      );
    },
    [],
  );

  const handleBranchSettingsUpdate = useCallback(
    async (patch: Partial<BranchConfig>) => {
      if (!activeBranchId) return;
      setBranches((prev) =>
        prev.map((b) => (b.id === activeBranchId ? { ...b, ...patch } : b)),
      );
      await fetch(`/api/branches/${activeBranchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    },
    [activeBranchId],
  );

  const handleChatSettingsUpdate = useCallback(
    async (patch: {
      factsExtractionModel?: string | null;
      factsExtractionRules?: string | null;
    }) => {
      if (!activeChatId) return;
      if (patch.factsExtractionModel !== undefined)
        setFactsExtractionModel(patch.factsExtractionModel);
      if (patch.factsExtractionRules !== undefined)
        setFactsExtractionRules(patch.factsExtractionRules);
      await fetch(`/api/chats/${activeChatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    },
    [activeChatId],
  );

  const resolvedStyle = (activeBranch?.communicationStyle ??
    globalStyle ??
    "normal") as CommunicationStyleKey;

  const handleStyleChange = useCallback(
    async (style: CommunicationStyleKey | null) => {
      if (!activeBranchId) return;
      setBranches((prev) =>
        prev.map((b) =>
          b.id === activeBranchId ? { ...b, communicationStyle: style } : b,
        ),
      );
      await fetch(`/api/branches/${activeBranchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communicationStyle: style }),
      });
    },
    [activeBranchId],
  );

  const handleGlobalStyleChange = useCallback(
    async (style: CommunicationStyleKey) => {
      setGlobalStyle(style);
      await fetch("/api/personalization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communicationStyle: style }),
      });
    },
    [],
  );

  const isMainBranch = activeBranch ? !activeBranch.parentBranchId : true;

  return (
    <div className="flex min-h-0 flex-1">
      <ChatSidebar
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        refreshKey={sidebarRefresh}
        messages={messages}
        contextLength={selectedModelData?.context_length ?? 200_000}
        pricing={selectedModelData?.pricing}
        contextState={activeChatId ? branchContextState : null}
        onOpenContextState={() => setContextStateOpen(true)}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <Header
          modelName={selectedModelData?.name ?? selectedModel}
          maxTokens={maxTokens}
          modelsLoading={modelsLoading}
          onOpenSettings={() => {
            setSettingsInitialTab(undefined);
            setSettingsOpen(true);
          }}
        />
        <SettingsDialog
          open={settingsOpen}
          onClose={() => {
            setSettingsOpen(false);
            setSettingsInitialTab(undefined);
          }}
          initialTab={settingsInitialTab}
          models={models}
          modelsLoading={modelsLoading}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          maxTokens={maxTokens}
          onMaxTokensChange={setMaxTokens}
          maxTokensLimit={maxTokensLimit}
          instructions={instructions}
          onInstructionsChange={setInstructions}
          branchConfig={activeChatId ? branchConfig : null}
          onBranchSettingsUpdate={handleBranchSettingsUpdate}
          branchName={activeBranch?.name}
          factsExtractionModel={factsExtractionModel}
          factsExtractionRules={factsExtractionRules}
          onChatSettingsUpdate={handleChatSettingsUpdate}
          showUserProfile={!!activeChatId}
          communicationStyle={globalStyle}
          onCommunicationStyleChange={handleGlobalStyleChange}
          onLocalModelsChanged={refetchModels}
        />
        <ContextStateDialog
          open={contextStateOpen}
          onClose={() => setContextStateOpen(false)}
          contextState={activeChatId ? branchContextState : null}
        />
        {activeChatId ? (
          <>
            <BranchTabs
              branches={branchTabs}
              activeBranchId={activeBranchId ?? 0}
              onSwitchBranch={handleSwitchBranch}
              onCreateFork={handleCreateFork}
              onDeleteBranch={handleDeleteBranch}
              onRenameBranch={handleRenameBranch}
            />
            <MessageList
              messages={messages}
              isLoading={isLoading}
              onDeleteMessage={handleDeleteMessage}
              showDeleteButton
              forkedAtMsgId={forkedAtMsgId}
              isMainBranch={isMainBranch}
              onForkFromMessage={
                isMainBranch ? handleForkFromMessage : undefined
              }
            />
            {error && (
              <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                {error.kind === "local-unreachable"
                  ? `Local model unreachable: ${error.original}`
                  : error.message}
              </div>
            )}
            <WorkingMemoryWidget
              workingMemory={workingMemory}
              branchId={activeBranchId}
              onUpdate={setWorkingMemory}
            />
            <MachineStateWidget
              machineState={machineState}
              branchId={activeBranchId}
              onStopped={() => setMachineState(null)}
            />
            <ChatInput
              onSend={handleSend}
              disabled={isLoading}
              communicationStyle={resolvedStyle}
              globalCommunicationStyle={globalStyle}
              onStyleChange={handleStyleChange}
              machineState={machineState}
              branchId={activeBranchId}
              onOpenMcpSettings={() => {
                setSettingsInitialTab("mcp");
                setSettingsOpen(true);
              }}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Welcome to Web Agent
            </h2>
            <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              Create a new chat or select an existing one from the sidebar to
              start a conversation.
            </p>
            <button
              type="button"
              onClick={handleNewChat}
              className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              New Chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function toDisplayMessage(m: {
  id: number;
  role: string;
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number | null;
  } | null;
}): ChatMessage {
  return {
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    usage: m.usage ?? undefined,
  };
}
