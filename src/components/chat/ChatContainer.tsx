"use client";

import { useMemo, useState } from "react";
import { InstructionsDialog } from "@/components/settings/InstructionsDialog";
import { Header } from "@/components/ui/Header";
import { useChat } from "@/hooks/useChat";
import { useModels } from "@/hooks/useModels";
import { DEFAULT_INSTRUCTIONS } from "@/lib/agent/constants";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";

const DEFAULT_MODEL = "openrouter/auto";
const DEFAULT_MAX_TOKENS = 1024;

export function ChatContainer() {
  const { models, isLoading: modelsLoading } = useModels();
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [maxTokens, setMaxTokens] = useState(DEFAULT_MAX_TOKENS);
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  const selectedModelData = useMemo(
    () => models.find((m) => m.id === selectedModel),
    [models, selectedModel],
  );

  const maxTokensLimit = selectedModelData?.context_length ?? 200_000;

  const { messages, isLoading, error, sendMessage, reset } = useChat({
    model: selectedModel,
    maxTokens,
    instructions,
  });

  return (
    <div className="flex flex-1 flex-col">
      <Header
        models={models}
        modelsLoading={modelsLoading}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        maxTokens={maxTokens}
        onMaxTokensChange={setMaxTokens}
        maxTokensLimit={maxTokensLimit}
        onNewChat={reset}
        onOpenInstructions={() => setInstructionsOpen(true)}
      />
      <InstructionsDialog
        open={instructionsOpen}
        value={instructions}
        onSave={setInstructions}
        onClose={() => setInstructionsOpen(false)}
      />
      <MessageList messages={messages} isLoading={isLoading} />
      {error && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
