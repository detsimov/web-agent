"use client";

import { useCallback, useEffect, useState } from "react";
import { ModelSelector } from "@/components/settings/ModelSelector";
import type { Model } from "@/lib/types";

type Fact = { key: string; value: string; updatedAt?: string };

type Props = {
  models: Model[];
  modelsLoading: boolean;
  factsExtractionModel: string | null;
  factsExtractionRules: string | null;
  onChatUpdate: (patch: {
    factsExtractionModel?: string | null;
    factsExtractionRules?: string | null;
  }) => void;
};

export function UserProfileTab({
  models,
  modelsLoading,
  factsExtractionModel,
  factsExtractionRules,
  onChatUpdate,
}: Props) {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const fetchFacts = useCallback(async () => {
    try {
      const res = await fetch("/api/global-facts");
      const data = await res.json();
      setFacts(data.facts ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFacts();
  }, [fetchFacts]);

  const handleAdd = useCallback(async () => {
    if (!newKey.trim()) return;
    try {
      await fetch("/api/global-facts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [newKey.trim()]: newValue }),
      });
      setNewKey("");
      setNewValue("");
      fetchFacts();
    } catch {
      // ignore
    }
  }, [newKey, newValue, fetchFacts]);

  const handleDelete = useCallback(
    async (key: string) => {
      try {
        await fetch(`/api/global-facts/${encodeURIComponent(key)}`, {
          method: "DELETE",
        });
        fetchFacts();
      } catch {
        // ignore
      }
    },
    [fetchFacts],
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Global Facts
        </span>
        {loading ? (
          <p className="text-sm text-zinc-400">Loading...</p>
        ) : (
          <div className="flex flex-col gap-1">
            {facts.map((f) => (
              <div
                key={f.key}
                className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span className="w-32 shrink-0 truncate font-mono text-zinc-500 dark:text-zinc-400">
                  {f.key}
                </span>
                <span className="flex-1 truncate text-zinc-700 dark:text-zinc-200">
                  {f.value}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(f.key)}
                  className="shrink-0 text-xs text-zinc-400 hover:text-red-500"
                >
                  x
                </button>
              </div>
            ))}
            {facts.length === 0 && (
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                No facts yet. They will be extracted automatically during
                conversations.
              </p>
            )}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder="Key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="w-32 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <input
            type="text"
            placeholder="Value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-md bg-zinc-200 px-3 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
          >
            Add
          </button>
        </div>
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Extraction Model
        </span>
        <ModelSelector
          models={models}
          value={factsExtractionModel ?? ""}
          onChange={(id) => onChatUpdate({ factsExtractionModel: id || null })}
          isLoading={modelsLoading}
        />
      </div>

      <div>
        <label
          htmlFor="facts-rules"
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Extraction Rules
        </label>
        <textarea
          id="facts-rules"
          value={factsExtractionRules ?? ""}
          onChange={(e) =>
            onChatUpdate({
              factsExtractionRules: e.target.value || null,
            })
          }
          placeholder="Custom rules for what to extract..."
          className="h-20 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>
    </div>
  );
}
