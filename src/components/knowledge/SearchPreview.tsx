"use client";

import { useState } from "react";
import type { SearchResult } from "@/lib/rag/types";

type Props = {
  collectionId: number;
};

export function SearchPreview({ collectionId }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/rag/collections/${collectionId}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: 5 }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

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

      {searched && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              No results found.
            </div>
          ) : (
            results.map((result, _i) => (
              <div
                key={`${result.documentTitle}-${result.chunkIndex}`}
                className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {result.documentTitle}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Score: {result.score.toFixed(4)}
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
