"use client";

import { useState } from "react";
import type { RagCollection } from "@/lib/rag/types";
import { CollectionForm } from "./CollectionForm";

type Props = {
  collections: RagCollection[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onRefresh: () => Promise<void>;
  loading: boolean;
};

export function CollectionList({
  collections,
  selectedId,
  onSelect,
  onRefresh,
  loading,
}: Props) {
  const [showForm, setShowForm] = useState(false);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Collections
        </span>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          title="New Collection"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 text-sm text-zinc-400">Loading...</div>
        ) : (
          collections.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                selectedId === c.id
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
              }`}
            >
              <div className="font-medium truncate">{c.name}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {c.documentCount ?? 0} docs &middot; {c.chunkCount ?? 0} chunks
              </div>
            </button>
          ))
        )}
      </div>

      {showForm && (
        <CollectionForm
          onClose={() => setShowForm(false)}
          onCreated={async () => {
            setShowForm(false);
            await onRefresh();
          }}
        />
      )}
    </aside>
  );
}
