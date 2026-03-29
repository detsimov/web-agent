"use client";

import { useEffect, useRef, useState } from "react";
import type { BranchConfig } from "@/components/settings/BranchSettings";
import { ContextTab } from "@/components/settings/ContextTab";
import { GeneralTab } from "@/components/settings/GeneralTab";
import type { Model } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  // General tab
  models: Model[];
  modelsLoading: boolean;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  maxTokens: number;
  onMaxTokensChange: (value: number) => void;
  maxTokensLimit: number;
  instructions: string;
  onInstructionsChange: (value: string) => void;
  // Context tab
  branchConfig: BranchConfig | null;
  onBranchSettingsUpdate: (patch: Partial<BranchConfig>) => void;
  branchName?: string;
};

export function SettingsDialog({
  open,
  onClose,
  models,
  modelsLoading,
  selectedModel,
  onModelChange,
  maxTokens,
  onMaxTokensChange,
  maxTokensLimit,
  instructions,
  onInstructionsChange,
  branchConfig,
  onBranchSettingsUpdate,
  branchName,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"general" | "context">("general");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 m-auto w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-0 shadow-xl backdrop:bg-black/50 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="flex max-h-[80vh] flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-200 px-6 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setTab("general")}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              tab === "general"
                ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            General
          </button>
          <button
            type="button"
            onClick={() => setTab("context")}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              tab === "context"
                ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Context
          </button>
        </div>

        {/* Tab content */}
        <div className="overflow-y-auto p-6">
          {tab === "general" && (
            <GeneralTab
              models={models}
              modelsLoading={modelsLoading}
              selectedModel={selectedModel}
              onModelChange={onModelChange}
              maxTokens={maxTokens}
              onMaxTokensChange={onMaxTokensChange}
              maxTokensLimit={maxTokensLimit}
              instructions={instructions}
              onInstructionsChange={onInstructionsChange}
            />
          )}
          {tab === "context" && branchConfig && (
            <ContextTab
              config={branchConfig}
              onUpdate={onBranchSettingsUpdate}
              models={models}
              modelsLoading={modelsLoading}
              branchName={branchName}
            />
          )}
          {tab === "context" && !branchConfig && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Select a chat to configure context settings.
            </p>
          )}
        </div>
      </div>
    </dialog>
  );
}
