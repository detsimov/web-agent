"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Model } from "@/lib/types";

type Props = {
  models: Model[];
  value: string;
  onChange: (modelId: string) => void;
  isLoading: boolean;
};

const LOCAL_GROUP_KEY = "ollama";
const LOCAL_GROUP_LABEL = "Local";

function groupByProvider(models: Model[]): Array<[string, Model[]]> {
  const groups: Record<string, Model[]> = {};
  for (const model of models) {
    const provider = model.id.split("/")[0] ?? "other";
    if (!groups[provider]) {
      groups[provider] = [];
    }
    groups[provider].push(model);
  }

  const entries = Object.entries(groups);
  return entries.sort(([a], [b]) => {
    if (a === LOCAL_GROUP_KEY) return -1;
    if (b === LOCAL_GROUP_KEY) return 1;
    return 0;
  });
}

function groupLabel(key: string): string {
  return key === LOCAL_GROUP_KEY ? LOCAL_GROUP_LABEL : key;
}

function formatPrice(price: string) {
  const n = Number.parseFloat(price) * 1_000_000;
  if (n === 0) return "free";
  if (n < 0.01) return "<$0.01/M";
  return `$${n.toFixed(2)}/M`;
}

export function ModelSelector({ models, value, onChange, isLoading }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    if (!search) return models;
    const q = search.toLowerCase();
    return models.filter(
      (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
    );
  }, [models, search]);

  const grouped = useMemo(() => groupByProvider(filtered), [filtered]);
  const flatFiltered = useMemo(() => {
    const result: Model[] = [];
    for (const [, group] of grouped) {
      result.push(...group);
    }
    return result;
  }, [grouped]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset highlight when search changes
  useEffect(() => {
    setHighlightIndex(0);
  }, [search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      setHighlightIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setHighlightIndex((i) => Math.max(i - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter") {
      const model = flatFiltered[highlightIndex];
      if (model) {
        onChange(model.id);
        setOpen(false);
        setSearch("");
      }
      e.preventDefault();
    } else if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    }
  }

  const selectedModel = models.find((m) => m.id === value);
  const displayValue = open ? search : (selectedModel?.name ?? value);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: combobox wrapper delegates to input
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <input
        type="text"
        value={displayValue}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setSearch("");
        }}
        placeholder={isLoading ? "Loading models..." : "Select model"}
        disabled={isLoading}
        className="w-full min-w-[200px] rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-400"
      />
      {open && flatFiltered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute left-0 top-full z-50 mt-1 max-h-80 w-[360px] overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
        >
          {grouped.map(([provider, providerModels]) => (
            <li key={provider}>
              <div className="sticky top-0 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                {groupLabel(provider)}
              </div>
              {providerModels.map((model) => {
                const idx = flatFiltered.indexOf(model);
                return (
                  <button
                    type="button"
                    key={model.id}
                    className={`flex w-full cursor-pointer flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 ${idx === highlightIndex ? "bg-zinc-100 dark:bg-zinc-700" : ""}`}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(model.id);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {model.name}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {model.context_length.toLocaleString()} ctx &middot; in{" "}
                      {formatPrice(model.pricing.prompt)} &middot; out{" "}
                      {formatPrice(model.pricing.completion)}
                    </span>
                  </button>
                );
              })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
