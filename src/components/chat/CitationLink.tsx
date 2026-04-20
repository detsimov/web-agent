"use client";

import { useEffect, useRef, useState } from "react";

type ChunkData = {
  content: string;
  chunkIndex: number;
  documentTitle: string;
  collectionName: string;
};

type Props = {
  collectionSlug: string;
  docSlug: string;
  chunkIndex: number;
  display: string;
};

export function CitationLink({
  collectionSlug,
  docSlug,
  chunkIndex,
  display,
}: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ChunkData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !data && !loading) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/rag/chunks/${encodeURIComponent(collectionSlug)}/${encodeURIComponent(docSlug)}/${chunkIndex}`,
        );
        if (res.ok) {
          setData(await res.json());
        } else if (res.status === 404) {
          setError("Source chunk no longer exists.");
        } else {
          setError("Failed to load source.");
        }
      } catch {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <span className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        className="mx-0.5 cursor-pointer rounded bg-blue-100 px-1 font-mono text-[0.85em] text-blue-700 no-underline hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
        title={`${collectionSlug}:${docSlug}:${chunkIndex}`}
      >
        {display}
      </button>
      {open && (
        <span
          role="dialog"
          className="absolute top-full left-0 z-50 mt-1 block w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        >
          {loading && (
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
              Loading…
            </span>
          )}
          {error && (
            <span className="block text-xs text-red-600 dark:text-red-400">
              {error}
            </span>
          )}
          {data && (
            <>
              <span className="mb-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">
                  {data.documentTitle}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                  {data.collectionName} · chunk {data.chunkIndex}
                </span>
              </span>
              <span className="block max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                {data.content}
              </span>
            </>
          )}
        </span>
      )}
    </span>
  );
}
