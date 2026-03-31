"use client";

import { MaxTokensInput } from "@/components/settings/MaxTokensInput";
import { ModelSelector } from "@/components/settings/ModelSelector";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  COMMUNICATION_STYLES,
  type CommunicationStyleKey,
} from "@/lib/communication-styles";
import type { Model } from "@/lib/types";

const STYLE_KEYS = Object.keys(COMMUNICATION_STYLES) as CommunicationStyleKey[];

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
  communicationStyle: CommunicationStyleKey;
  onCommunicationStyleChange: (style: CommunicationStyleKey) => void;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

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
  communicationStyle,
  onCommunicationStyleChange,
}: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* Model & Tokens */}
      <Section title="Model">
        <div className="flex flex-col gap-4">
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
          <MaxTokensInput
            value={maxTokens}
            onChange={onMaxTokensChange}
            max={maxTokensLimit}
          />
        </div>
      </Section>

      <hr className="border-zinc-100 dark:border-zinc-800" />

      {/* System Instructions */}
      <Section title="Instructions">
        <div>
          <textarea
            id="settings-instructions"
            value={instructions}
            onChange={(e) => onInstructionsChange(e.target.value)}
            rows={5}
            maxLength={4000}
            className="w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none transition-colors focus:border-zinc-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:bg-zinc-800"
            placeholder="Enter instructions for the AI..."
          />
          <span className="mt-0.5 block text-right text-xs text-zinc-400 dark:text-zinc-600">
            {instructions.length}/4000
          </span>
        </div>
      </Section>

      <hr className="border-zinc-100 dark:border-zinc-800" />

      {/* Communication Style */}
      <Section title="Communication Style">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {STYLE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onCommunicationStyleChange(key)}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition-all duration-150 ${
                communicationStyle === key
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
                  : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
              }`}
            >
              {COMMUNICATION_STYLES[key].label}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Applied to all chats unless overridden per branch.
        </p>
      </Section>

      <hr className="border-zinc-100 dark:border-zinc-800" />

      {/* Appearance */}
      <Section title="Appearance">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Theme
            </span>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Toggle light and dark mode
            </p>
          </div>
          <ThemeToggle />
        </div>
      </Section>
    </div>
  );
}
