"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  RagCollection,
  SearchEnvelope,
  SearchResult,
} from "@/lib/rag/types";

type Props = {
  collectionId: number;
};

export function SearchPreview({ collectionId }: Props) {
  const [query, setQuery] = useState("");
  const [envelope, setEnvelope] = useState<SearchEnvelope | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [collection, setCollection] = useState<RagCollection | null>(null);
  const [vectorThreshold, setVectorThreshold] = useState(0.3);
  const [rerankThreshold, setRerankThreshold] = useState(0.3);
  const [thresholdsDirty, setThresholdsDirty] = useState(false);
  const [savingThresholds, setSavingThresholds] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rag/collections/${collectionId}`)
      .then((r) => r.json())
      .then((data: RagCollection) => {
        if (cancelled) return;
        setCollection(data);
        setVectorThreshold(data.vectorThreshold ?? 0.3);
        setRerankThreshold(data.rerankThreshold ?? 0.3);
        setThresholdsDirty(false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/rag/collections/${collectionId}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: 20 }),
      });
      const data: SearchEnvelope = await res.json();
      setEnvelope(data);
    } catch {
      setEnvelope({ results: [] });
    } finally {
      setSearching(false);
    }
  }

  async function handleSaveThresholds() {
    setSavingThresholds(true);
    try {
      const res = await fetch(`/api/rag/collections/${collectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vectorThreshold,
          rerankThreshold,
        }),
      });
      if (res.ok) {
        const updated: RagCollection = await res.json();
        setCollection(updated);
        setThresholdsDirty(false);
      }
    } finally {
      setSavingThresholds(false);
    }
  }

  const rerankEnabled = collection?.rerankEnabled ?? true;

  const filteredResults = useMemo(() => {
    if (!envelope) return [] as SearchResult[];
    return envelope.results.filter((r) => {
      if (r.vectorScore < vectorThreshold) return false;
      if (
        rerankEnabled &&
        r.rerankScore !== null &&
        r.rerankScore < rerankThreshold
      ) {
        return false;
      }
      return true;
    });
  }, [envelope, vectorThreshold, rerankThreshold, rerankEnabled]);

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Search Preview
      </h3>

      <form onSubmit={handleSearch} className="flex gap-2 mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Test a search query..."
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {searching ? "..." : "Search"}
        </button>
      </form>

      <div className="mb-3 space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
        <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
          <span>Vector threshold</span>
          <span className="font-mono">{vectorThreshold.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={vectorThreshold}
          onChange={(e) => {
            setVectorThreshold(Number(e.target.value));
            setThresholdsDirty(true);
          }}
          className="w-full"
        />
        <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
          <span>Rerank threshold</span>
          <span className="font-mono">{rerankThreshold.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={rerankThreshold}
          disabled={!rerankEnabled}
          onChange={(e) => {
            setRerankThreshold(Number(e.target.value));
            setThresholdsDirty(true);
          }}
          className="w-full disabled:opacity-50"
        />
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleSaveThresholds}
            disabled={!thresholdsDirty || savingThresholds}
            className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {savingThresholds ? "Saving..." : "Save threshold"}
          </button>
        </div>
      </div>

      {searched && envelope && (
        <div className="space-y-2">
          {envelope.needsClarification && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              <div className="font-medium">
                No results above threshold (mode:{" "}
                {envelope.clarificationMode ?? "—"})
              </div>
              {envelope.reason && <div>{envelope.reason}</div>}
            </div>
          )}
          {envelope.rerankFailed && (
            <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
              Rerank failed — showing vector-only ordering.
            </div>
          )}
          {filteredResults.length === 0 ? (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              {envelope.results.length === 0
                ? "No results found."
                : `${envelope.results.length} result(s) filtered out by local thresholds. Lower the sliders to inspect.`}
            </div>
          ) : (
            filteredResults.map((result) => (
              <div
                key={result.citationId}
                className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {result.documentTitle}
                  </span>
                  <span className="font-mono text-zinc-500 dark:text-zinc-400">
                    [{result.documentSlug}:{result.chunkIndex}]
                  </span>
                </div>
                <div className="mb-1 flex gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>vec {result.vectorScore.toFixed(3)}</span>
                  <span>
                    rerank{" "}
                    {result.rerankScore !== null
                      ? result.rerankScore.toFixed(3)
                      : "—"}
                  </span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">
                  {result.content}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
