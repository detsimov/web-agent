"use client";

import { useState } from "react";
import type { RagCollection } from "@/lib/rag/types";
import { CollectionForm } from "./CollectionForm";
import { DocumentList } from "./DocumentList";
import { SearchPreview } from "./SearchPreview";

type Props = {
  collection: RagCollection;
  onRefresh: () => Promise<void>;
};

export function CollectionDetail({ collection, onRefresh }: Props) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  async function handleDelete() {
    if (
      !confirm(`Delete collection "${collection.name}" and all its documents?`)
    )
      return;
    setDeleting(true);
    try {
      await fetch(`/api/rag/collections/${collection.id}`, {
        method: "DELETE",
      });
      await onRefresh();
    } finally {
      setDeleting(false);
    }
  }

  async function handleRebuild() {
    if (
      !confirm(
        `Re-embed all ${collection.chunkCount ?? 0} chunks with ${collection.embeddingModel}? This may take a while.`,
      )
    )
      return;
    setRebuilding(true);
    try {
      await fetch(`/api/rag/collections/${collection.id}/rebuild`, {
        method: "POST",
      });
      await onRefresh();
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {collection.name}
          </h2>
          {collection.description && (
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              {collection.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
              {collection.embeddingModel}
            </span>
            <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
              {collection.chunkingStrategy}
            </span>
            <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
              {collection.embeddingDimensions}d
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {collection.needsRebuild && (
            <button
              type="button"
              onClick={handleRebuild}
              disabled={rebuilding}
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
            >
              {rebuilding ? "Rebuilding..." : "Rebuild Vectors"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      {/* Documents */}
      <DocumentList collectionId={collection.id} onRefresh={onRefresh} />

      {/* Search Preview */}
      <SearchPreview collectionId={collection.id} />

      {/* Edit modal */}
      {editing && (
        <CollectionForm
          collection={collection}
          onClose={() => setEditing(false)}
          onCreated={async () => {
            setEditing(false);
            await onRefresh();
          }}
        />
      )}
    </div>
  );
}
