"use client";

import { MaxTokensInput } from "@/components/settings/MaxTokensInput";
import { ModelSelector } from "@/components/settings/ModelSelector";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { Model } from "@/lib/types";

type Props = {
  models: Model[];
  modelsLoading: boolean;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  maxTokens: number;
  onMaxTokensChange: (value: number) => void;
  maxTokensLimit: number;
  instructions: string;
  onInstructionsChange: (value: string) => void;
};

export function GeneralTab({
  models,
  modelsLoading,
  selectedModel,
  onModelChange,
  maxTokens,
  onMaxTokensChange,
  maxTokensLimit,
  instructions,
  onInstructionsChange,
}: Props) {
  return (
    <div className="flex flex-col gap-5">
      {/* Model */}
      <div>
        <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Model
        </span>
        <ModelSelector
          models={models}
          value={selectedModel}
          onChange={onModelChange}
          isLoading={modelsLoading}
        />
      </div>

      {/* Max Tokens */}
      <div>
        <MaxTokensInput
          value={maxTokens}
          onChange={onMaxTokensChange}
          max={maxTokensLimit}
        />
      </div>

      {/* System Instructions */}
      <div>
        <label
          htmlFor="settings-instructions"
          className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          System Instructions
        </label>
        <textarea
          id="settings-instructions"
          value={instructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
          rows={6}
          maxLength={4000}
          className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-400"
          placeholder="Enter instructions for the AI..."
        />
        <span className="mt-0.5 block text-right text-xs text-zinc-400 dark:text-zinc-500">
          {instructions.length}/4000
        </span>
      </div>

      {/* Appearance */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Theme
        </span>
        <ThemeToggle />
      </div>
    </div>
  );
}
