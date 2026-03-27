"use client";

import { useCallback, useMemo, useState } from "react";
import { InstructionsDialog } from "@/components/settings/InstructionsDialog";
import type {
  SummarizationConfig,
  SummaryState,
} from "@/components/settings/SummarizationSettings";
import { ChatSidebar } from "@/components/sidebar/ChatSidebar";
import { Header } from "@/components/ui/Header";
import { useChat } from "@/hooks/useChat";
import { useModels } from "@/hooks/useModels";
import { DEFAULT_INSTRUCTIONS } from "@/lib/agent/constants";
import type { ChatMessage } from "@/lib/types";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";

const DEFAULT_MODEL = "openrouter/auto";
const DEFAULT_MAX_TOKENS = 8192;

const DEFAULT_SUMMARIZATION_CONFIG: SummarizationConfig = {
  summarizationStrategy: null,
  summarizationModel: null,
  summarizationEvery: null,
  summarizationRatio: null,
  summarizationKeep: null,
};

export function ChatContainer() {
  const { models, isLoading: modelsLoading } = useModels();
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [maxTokens, setMaxTokens] = useState(DEFAULT_MAX_TOKENS);
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);
  const [summarizationConfig, setSummarizationConfig] =
    useState<SummarizationConfig>(DEFAULT_SUMMARIZATION_CONFIG);
  const [summaryState, setSummaryState] = useState<SummaryState | null>(null);

  const selectedModelData = useMemo(
    () => models.find((m) => m.id === selectedModel),
    [models, selectedModel],
  );

  const maxTokensLimit = selectedModelData?.context_length ?? 200_000;

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    reset,
    loadMessages,
    removeMessage,
  } = useChat({
    model: selectedModel,
    maxTokens,
    instructions,
    chatId: activeChatId,
  });

  const handleSelectChat = useCallback(
    async (chatId: number) => {
      setActiveChatId(chatId);
      const res = await fetch(`/api/chats/${chatId}`);
      if (res.ok) {
        const data = await res.json();
        const msgs: ChatMessage[] = data.chat.messages.map(
          (m: {
            id: number;
            role: string;
            content: string;
            usage?: {
              inputTokens: number;
              outputTokens: number;
              totalTokens: number;
              cost: number | null;
            } | null;
          }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            usage: m.usage ?? undefined,
          }),
        );
        loadMessages(msgs);
        setSummarizationConfig({
          summarizationStrategy: data.chat.summarizationStrategy ?? null,
          summarizationModel: data.chat.summarizationModel ?? null,
          summarizationEvery: data.chat.summarizationEvery ?? null,
          summarizationRatio: data.chat.summarizationRatio ?? null,
          summarizationKeep: data.chat.summarizationKeep ?? null,
        });
        setSummaryState(data.summary ?? null);
      }
    },
    [loadMessages],
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
      setActiveChatId(data.chat.id);
      reset();
      setSummarizationConfig(DEFAULT_SUMMARIZATION_CONFIG);
      setSummaryState(null);
      setSidebarRefresh((n) => n + 1);
    }
  }, [reset, maxTokens, instructions]);

  const handleDeleteChat = useCallback(
    (chatId: number) => {
      if (chatId === activeChatId) {
        setActiveChatId(null);
        reset();
        setSummarizationConfig(DEFAULT_SUMMARIZATION_CONFIG);
        setSummaryState(null);
      }
    },
    [activeChatId, reset],
  );

  const handleDeleteMessage = useCallback(
    async (messageId: number) => {
      if (!activeChatId) return;
      const res = await fetch(
        `/api/chats/${activeChatId}/messages/${messageId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        removeMessage(messageId);
      }
    },
    [activeChatId, removeMessage],
  );

  const handleSend = useCallback(
    async (content: string) => {
      await sendMessage(content);
      setSidebarRefresh((n) => n + 1);
    },
    [sendMessage],
  );

  const handleSummarizationUpdate = useCallback(
    async (patch: Partial<SummarizationConfig>) => {
      if (!activeChatId) return;
      const updated = { ...summarizationConfig, ...patch };
      setSummarizationConfig(updated);

      await fetch(`/api/chats/${activeChatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    },
    [activeChatId, summarizationConfig],
  );

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
        summarizationConfig={activeChatId ? summarizationConfig : null}
        onSummarizationUpdate={handleSummarizationUpdate}
        summaryState={activeChatId ? summaryState : null}
        models={models}
        modelsLoading={modelsLoading}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <Header
          models={models}
          modelsLoading={modelsLoading}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          maxTokens={maxTokens}
          onMaxTokensChange={setMaxTokens}
          maxTokensLimit={maxTokensLimit}
          onOpenInstructions={() => setInstructionsOpen(true)}
        />
        <InstructionsDialog
          open={instructionsOpen}
          value={instructions}
          onSave={setInstructions}
          onClose={() => setInstructionsOpen(false)}
        />
        {activeChatId ? (
          <>
            <MessageList
              messages={messages}
              isLoading={isLoading}
              onDeleteMessage={handleDeleteMessage}
              showDeleteButton
            />
            {error && (
              <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                {error}
              </div>
            )}
            <ChatInput onSend={handleSend} disabled={isLoading} />
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
