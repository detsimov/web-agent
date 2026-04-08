"use client";

import { useCallback, useEffect, useState } from "react";
import { ModelSelector } from "@/components/settings/ModelSelector";
import { useModels } from "@/hooks/useModels";

type TelegramConfig = {
  botToken: string;
  telegramId: string;
  parseMode: "Markdown" | "HTML";
};

type Bridge = {
  id: number;
  name: string;
  type: string;
  enabled: boolean;
  llmModel: string;
  llmPrompt: string;
  config: TelegramConfig;
};

type FormData = {
  name: string;
  type: string;
  enabled: boolean;
  llmModel: string;
  llmPrompt: string;
  botToken: string;
  telegramId: string;
  parseMode: "Markdown" | "HTML";
};

const EMPTY_FORM: FormData = {
  name: "",
  type: "telegram",
  enabled: true,
  llmModel: "",
  llmPrompt:
    "Format this notification for Telegram.\nType: {{type}}\nServer: {{serverName}}\nData: {{payload}}\n\nBe concise and human-readable.",
  botToken: "",
  telegramId: "",
  parseMode: "Markdown",
};

function validate(data: FormData): string[] {
  const errs: string[] = [];
  if (!data.name.trim()) errs.push("Name is required");
  if (!data.llmModel.trim()) errs.push("LLM Model is required");
  if (!data.llmPrompt.trim()) errs.push("LLM Prompt is required");
  if (!data.botToken.trim()) errs.push("Bot Token is required");
  if (!data.telegramId.trim()) errs.push("Telegram ID is required");
  return errs;
}

function bridgeToForm(b: Bridge): FormData {
  return {
    name: b.name,
    type: b.type,
    enabled: b.enabled,
    llmModel: b.llmModel,
    llmPrompt: b.llmPrompt,
    botToken: b.config.botToken ?? "",
    telegramId: b.config.telegramId ?? "",
    parseMode: b.config.parseMode ?? "Markdown",
  };
}

function formToPayload(f: FormData) {
  return {
    name: f.name,
    type: f.type,
    enabled: f.enabled,
    llmModel: f.llmModel,
    llmPrompt: f.llmPrompt,
    config: {
      botToken: f.botToken,
      telegramId: f.telegramId,
      parseMode: f.parseMode,
    },
  };
}

export function NotificationBridgesTab() {
  const { models, isLoading: modelsLoading } = useModels();
  const [bridges, setBridges] = useState<Bridge[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);

  const fetchBridges = useCallback(async () => {
    try {
      const res = await fetch("/api/notification-bridges");
      const data = await res.json();
      setBridges(data.bridges ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBridges();
  }, [fetchBridges]);

  const handleToggle = useCallback(
    async (id: number, enabled: boolean) => {
      setBridges((prev) =>
        prev.map((b) => (b.id === id ? { ...b, enabled } : b)),
      );
      try {
        await fetch(`/api/notification-bridges/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        });
      } catch {
        fetchBridges();
      }
    },
    [fetchBridges],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      setBridges((prev) => prev.filter((b) => b.id !== id));
      try {
        await fetch(`/api/notification-bridges/${id}`, { method: "DELETE" });
      } catch {
        fetchBridges();
      }
    },
    [fetchBridges],
  );

  const startEdit = useCallback((b: Bridge) => {
    setEditing(b.id);
    setForm(bridgeToForm(b));
    setErrors([]);
  }, []);

  const startCreate = useCallback(() => {
    setEditing("new");
    setForm(EMPTY_FORM);
    setErrors([]);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditing(null);
    setErrors([]);
  }, []);

  const handleSave = useCallback(async () => {
    const errs = validate(form);
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }

    try {
      if (editing === "new") {
        await fetch("/api/notification-bridges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formToPayload(form)),
        });
      } else {
        await fetch(`/api/notification-bridges/${editing}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formToPayload(form)),
        });
      }
      setEditing(null);
      fetchBridges();
    } catch {
      setErrors(["Failed to save"]);
    }
  }, [editing, form, fetchBridges]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (editing !== null) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {editing === "new" ? "Add Bridge" : "Edit Bridge"}
          </h3>
          <button
            type="button"
            onClick={cancelEdit}
            className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>

        {errors.length > 0 && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {errors.join(", ")}
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Name
          </span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g., my-telegram"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>

        <div>
          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            LLM Model
          </span>
          <ModelSelector
            models={models}
            value={form.llmModel}
            onChange={(modelId) =>
              setForm((f) => ({ ...f, llmModel: modelId }))
            }
            isLoading={modelsLoading}
          />
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            LLM Prompt
          </span>
          <textarea
            value={form.llmPrompt}
            onChange={(e) =>
              setForm((f) => ({ ...f, llmPrompt: e.target.value }))
            }
            rows={4}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <span className="mt-0.5 block text-[11px] text-zinc-400">
            {"Variables: {{type}}, {{serverName}}, {{payload}}"}
          </span>
        </label>

        <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <span className="mb-2 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Telegram
          </span>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Bot Token
              </span>
              <input
                type="password"
                value={form.botToken}
                onChange={(e) =>
                  setForm((f) => ({ ...f, botToken: e.target.value }))
                }
                placeholder="123456:ABC-..."
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-mono text-sm text-zinc-900 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Chat ID
              </span>
              <input
                type="password"
                value={form.telegramId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, telegramId: e.target.value }))
                }
                placeholder="e.g., 123456789"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-mono text-sm text-zinc-900 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>

            <fieldset>
              <legend className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                Parse Mode
              </legend>
              <div className="flex gap-4">
                {(["Markdown", "HTML"] as const).map((m) => (
                  <label key={m} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="parseMode"
                      checked={form.parseMode === m}
                      onChange={() => setForm((f) => ({ ...f, parseMode: m }))}
                      className="accent-blue-500"
                    />
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {m}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Save
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Notification Bridges
        </h3>
        <button
          type="button"
          onClick={startCreate}
          className="cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
        >
          Add Bridge
        </button>
      </div>

      {bridges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 py-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No notification bridges configured yet.
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Add a bridge to deliver notifications from MCP servers.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {bridges.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-800/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {b.name}
                  </span>
                  <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                    {b.type}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                  <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-700">
                    {b.llmModel}
                  </code>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => startEdit(b)}
                  className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                  title="Edit"
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
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(b.id)}
                  className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                  title="Delete"
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
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
                <label className="relative ml-1 inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={b.enabled}
                    onChange={(e) => handleToggle(b.id, e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="h-5 w-9 rounded-full bg-zinc-300 after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-4 dark:bg-zinc-600" />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
