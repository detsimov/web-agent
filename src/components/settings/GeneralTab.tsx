"use client";

import { useCallback, useEffect, useState } from "react";
import { MaxTokensInput } from "@/components/settings/MaxTokensInput";
import { ModelSelector } from "@/components/settings/ModelSelector";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  COMMUNICATION_STYLES,
  type CommunicationStyleKey,
} from "@/lib/communication-styles";
import type { Model } from "@/lib/types";

const STYLE_KEYS = Object.keys(COMMUNICATION_STYLES) as CommunicationStyleKey[];

type LocalModelsState = {
  baseUrl: string | null;
  status: "ok" | "error" | "unconfigured";
  error?: string;
  models: Model[];
};

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
  onLocalModelsChanged?: () => void;
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

function StatusIndicator({ state }: { state: LocalModelsState | null }) {
  if (!state) {
    return (
      <span className="text-xs text-zinc-400 dark:text-zinc-500">
        Loading...
      </span>
    );
  }
  if (state.status === "ok") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Connected · {state.models.length} model
        {state.models.length === 1 ? "" : "s"}
      </span>
    );
  }
  if (state.status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        {state.error ?? "Connection error"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
      Not configured
    </span>
  );
}

function LocalModelsSection({
  onLocalModelsChanged,
}: {
  onLocalModelsChanged?: () => void;
}) {
  const [state, setState] = useState<LocalModelsState | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const applyState = useCallback((next: LocalModelsState) => {
    setState(next);
    setDraft(next.baseUrl ?? "");
  }, []);

  const fetchState = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/local-models");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        applyState({
          baseUrl: null,
          status: "error",
          error: body?.error ?? `Request failed (${res.status})`,
          models: [],
        });
        return;
      }
      const json = (await res.json()) as LocalModelsState;
      applyState(json);
    } catch (err) {
      applyState({
        baseUrl: null,
        status: "error",
        error: err instanceof Error ? err.message : "Network error",
        models: [],
      });
    } finally {
      setBusy(false);
    }
  }, [applyState]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const persist = useCallback(
    async (next: string | null) => {
      setBusy(true);
      try {
        const res = await fetch("/api/local-models", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baseUrl: next }),
        });
        const body = (await res.json().catch(() => null)) as
          | LocalModelsState
          | { error?: string }
          | null;
        if (!res.ok) {
          const errMessage =
            (body && "error" in body && body.error) ||
            `Request failed (${res.status})`;
          setState((prev) => ({
            baseUrl: prev?.baseUrl ?? null,
            status: "error",
            error: errMessage,
            models: prev?.models ?? [],
          }));
          return;
        }
        applyState(body as LocalModelsState);
        onLocalModelsChanged?.();
      } catch (err) {
        setState((prev) => ({
          baseUrl: prev?.baseUrl ?? null,
          status: "error",
          error: err instanceof Error ? err.message : "Network error",
          models: prev?.models ?? [],
        }));
      } finally {
        setBusy(false);
      }
    },
    [applyState, onLocalModelsChanged],
  );

  const handleSave = useCallback(() => {
    const trimmed = draft.trim();
    const stored = state?.baseUrl ?? "";
    if (trimmed === stored) return;
    persist(trimmed === "" ? null : trimmed);
  }, [draft, persist, state?.baseUrl]);

  return (
    <Section title="Local Models">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Ollama
          </span>
          <StatusIndicator state={state} />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
            placeholder="http://localhost:11434/v1"
            disabled={busy}
            className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-400"
          />
          <button
            type="button"
            onClick={fetchState}
            disabled={busy}
            className="cursor-pointer rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            Refresh
          </button>
        </div>
        {state?.status === "ok" && state.models.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
            {state.models.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between text-xs"
              >
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {m.name}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {m.context_length.toLocaleString()} ctx
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Connect to a local Ollama instance to enable offline models. Falls
          back to <code>OLLAMA_BASE_URL</code> env when unset.
        </p>
      </div>
    </Section>
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
  onLocalModelsChanged,
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

      <LocalModelsSection onLocalModelsChanged={onLocalModelsChanged} />

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
