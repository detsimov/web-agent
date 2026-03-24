"use client";

import { MaxTokensInput } from "@/components/settings/MaxTokensInput";
import { ModelSelector } from "@/components/settings/ModelSelector";
import type { Model } from "@/lib/types";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  models: Model[];
  modelsLoading: boolean;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  maxTokens: number;
  onMaxTokensChange: (value: number) => void;
  maxTokensLimit: number;
  onOpenInstructions: () => void;
};

export function Header({
  models,
  modelsLoading,
  selectedModel,
  onModelChange,
  maxTokens,
  onMaxTokensChange,
  maxTokensLimit,
  onOpenInstructions,
}: Props) {
  return (
    <header className="flex flex-wrap items-end gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
      <ModelSelector
        models={models}
        value={selectedModel}
        onChange={onModelChange}
        isLoading={modelsLoading}
      />
      <MaxTokensInput
        value={maxTokens}
        onChange={onMaxTokensChange}
        max={maxTokensLimit}
      />
      <button
        type="button"
        onClick={onOpenInstructions}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-700"
      >
        System
      </button>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
