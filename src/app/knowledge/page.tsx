"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CollectionDetail } from "@/components/knowledge/CollectionDetail";
import { CollectionList } from "@/components/knowledge/CollectionList";
import type { RagCollection } from "@/lib/rag/types";

export default function KnowledgePage() {
  const [collections, setCollections] = useState<RagCollection[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch("/api/rag/collections");
      const data = await res.json();
      setCollections(data);
      setSelectedId((prev) =>
        prev === null && data.length > 0 ? data[0].id : prev,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const selected = collections.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-900">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Chat
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600">/</span>
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Knowledge
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <CollectionList
          collections={collections}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRefresh={fetchCollections}
          loading={loading}
        />

        <div className="flex-1 overflow-y-auto">
          {selected ? (
            <CollectionDetail
              collection={selected}
              onRefresh={fetchCollections}
            />
          ) : !loading ? (
            <div className="flex h-full items-center justify-center text-zinc-500 dark:text-zinc-400">
              <div className="text-center">
                <p className="text-lg font-medium">No collections yet</p>
                <p className="mt-1 text-sm">
                  Create your first collection to start building a knowledge
                  base.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
