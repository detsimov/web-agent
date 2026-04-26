"use client";

import { useEffect, useRef, useState } from "react";
import type { BranchConfig } from "@/components/settings/BranchSettings";
import { ContextTab } from "@/components/settings/ContextTab";
import { GeneralTab } from "@/components/settings/GeneralTab";
import { InvariantsTab } from "@/components/settings/InvariantsTab";
import { McpServersTab } from "@/components/settings/McpServersTab";
import { NotificationBridgesTab } from "@/components/settings/NotificationBridgesTab";
import { UserProfileTab } from "@/components/settings/UserProfileTab";
import type { CommunicationStyleKey } from "@/lib/communication-styles";
import type { Model } from "@/lib/types";

type TabKey =
  | "general"
  | "mcp"
  | "context"
  | "profile"
  | "invariants"
  | "notifications";

type TabDef = {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  hidden?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initialTab?: TabKey;
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
  // User Profile tab
  factsExtractionModel?: string | null;
  factsExtractionRules?: string | null;
  onChatSettingsUpdate?: (patch: {
    factsExtractionModel?: string | null;
    factsExtractionRules?: string | null;
  }) => void;
  showUserProfile?: boolean;
  // Communication style
  communicationStyle: CommunicationStyleKey;
  onCommunicationStyleChange: (style: CommunicationStyleKey) => void;
  // Local Models (Ollama)
  onLocalModelsChanged?: () => void;
};

const ICON_GENERAL = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const ICON_MCP = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 2v6m0 8v6M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24" />
  </svg>
);

const ICON_CONTEXT = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const ICON_PROFILE = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const ICON_INVARIANTS = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ICON_NOTIFICATIONS = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export function SettingsDialog({
  open,
  onClose,
  initialTab,
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
  factsExtractionModel,
  factsExtractionRules,
  onChatSettingsUpdate,
  showUserProfile,
  communicationStyle,
  onCommunicationStyleChange,
  onLocalModelsChanged,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<TabKey>(initialTab ?? "general");

  useEffect(() => {
    if (open && initialTab) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

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

  const tabs: TabDef[] = [
    { key: "general", label: "General", icon: ICON_GENERAL },
    { key: "mcp", label: "MCP Servers", icon: ICON_MCP },
    { key: "context", label: "Context", icon: ICON_CONTEXT },
    {
      key: "profile",
      label: "User Profile",
      icon: ICON_PROFILE,
      hidden: !showUserProfile,
    },
    { key: "invariants", label: "Invariants", icon: ICON_INVARIANTS },
    { key: "notifications", label: "Notifications", icon: ICON_NOTIFICATIONS },
  ];

  const visibleTabs = tabs.filter((t) => !t.hidden);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 m-auto h-[min(80vh,640px)] w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white p-0 shadow-2xl backdrop:bg-black/40 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="flex w-48 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-700/50 dark:bg-zinc-800/50">
          <div className="flex items-center justify-between px-4 pt-5 pb-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Settings
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-colors duration-150 hover:bg-zinc-200 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
              aria-label="Close settings"
            >
              <svg
                width="14"
                height="14"
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
          <nav className="flex flex-col gap-0.5 px-2">
            {visibleTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 ${
                  tab === t.key
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-200"
                }`}
              >
                <span
                  className={
                    tab === t.key
                      ? "text-zinc-700 dark:text-zinc-200"
                      : "text-zinc-400 dark:text-zinc-500"
                  }
                >
                  {t.icon}
                </span>
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-5">
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
                communicationStyle={communicationStyle}
                onCommunicationStyleChange={onCommunicationStyleChange}
                onLocalModelsChanged={onLocalModelsChanged}
              />
            )}
            {tab === "mcp" && <McpServersTab />}
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
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-zinc-400 dark:text-zinc-500">
                  Select a chat to configure context settings.
                </p>
              </div>
            )}
            {tab === "profile" && onChatSettingsUpdate && (
              <UserProfileTab
                models={models}
                modelsLoading={modelsLoading}
                factsExtractionModel={factsExtractionModel ?? null}
                factsExtractionRules={factsExtractionRules ?? null}
                onChatUpdate={onChatSettingsUpdate}
              />
            )}
            {tab === "invariants" && <InvariantsTab />}
            {tab === "notifications" && <NotificationBridgesTab />}
          </div>
        </div>
      </div>
    </dialog>
  );
}
