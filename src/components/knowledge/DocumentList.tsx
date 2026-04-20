"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RagDocument } from "@/lib/rag/types";

type Props = {
  collectionId: number;
  onRefresh: () => Promise<void>;
};

type UploadProgress = {
  filename: string;
  stage: string;
  detail?: string;
};

export function DocumentList({ collectionId, onRefresh }: Props) {
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [showTextForm, setShowTextForm] = useState(false);
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/rag/collections/${collectionId}/documents`);
      const data = await res.json();
      setDocuments(data);
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    setLoading(true);
    fetchDocs();
  }, [fetchDocs]);

  async function uploadWithProgress(
    body: FormData | string,
    filename: string,
    headers?: Record<string, string>,
  ) {
    setProgress({ filename, stage: "Uploading..." });

    const res = await fetch(`/api/rag/collections/${collectionId}/documents`, {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        ...headers,
      },
      body,
    });

    if (!res.ok || !res.body) {
      setProgress(null);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const data = line.replace(/^data: /, "").trim();
        if (!data) continue;
        try {
          const event = JSON.parse(data);
          switch (event.stage) {
            case "parsing":
              setProgress({ filename, stage: "Parsing file..." });
              break;
            case "chunking":
              setProgress({
                filename,
                stage: "Chunking...",
                detail: `${event.totalChunks} chunks`,
              });
              break;
            case "embedding":
              setProgress({
                filename,
                stage: "Embedding...",
                detail: `batch ${event.current}/${event.total}`,
              });
              break;
            case "storing":
              setProgress({ filename, stage: "Storing vectors..." });
              break;
            case "done":
              setProgress(null);
              break;
            case "error":
              setProgress({
                filename,
                stage: `Error: ${event.message}`,
              });
              setTimeout(() => setProgress(null), 3000);
              break;
          }
        } catch {
          // skip malformed events
        }
      }
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        await uploadWithProgress(formData, file.name);
      }
      await fetchDocs();
      await onRefresh();
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);
    try {
      await uploadWithProgress(
        JSON.stringify({ title: textTitle, content: textContent }),
        textTitle,
        { "Content-Type": "application/json" },
      );
      setTextTitle("");
      setTextContent("");
      setShowTextForm(false);
      await fetchDocs();
      await onRefresh();
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  async function handleDelete(docId: number) {
    await fetch(`/api/rag/collections/${collectionId}/documents/${docId}`, {
      method: "DELETE",
    });
    await fetchDocs();
    await onRefresh();
  }

  async function handleCopyCitationPrefix(slug: string) {
    try {
      await navigator.clipboard.writeText(`[${slug}:`);
    } catch {
      // Clipboard API may be unavailable
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Documents
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowTextForm(!showTextForm)}
            className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Add Text
          </button>
          <label className="cursor-pointer rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800">
            {uploading ? "Processing..." : "Upload Files"}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.md,.txt,.csv,.markdown"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {progress && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-800 dark:bg-blue-900/20">
          <svg
            className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400"
            viewBox="0 0 24 24"
            fill="none"
            role="img"
            aria-label="Processing"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="truncate text-blue-700 dark:text-blue-300">
            {progress.filename}:
          </span>
          <span className="text-blue-600 dark:text-blue-400">
            {progress.stage}
          </span>
          {progress.detail && (
            <span className="text-blue-500 dark:text-blue-500">
              ({progress.detail})
            </span>
          )}
        </div>
      )}

      {showTextForm && (
        <form
          onSubmit={handleTextSubmit}
          className="mb-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
        >
          <input
            type="text"
            placeholder="Title"
            value={textTitle}
            onChange={(e) => setTextTitle(e.target.value)}
            required
            className="mb-2 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <textarea
            placeholder="Content"
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            required
            rows={4}
            className="mb-2 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowTextForm(false)}
              className="rounded px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? "Saving..." : "Add"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-zinc-400">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No documents yet. Upload files or add text to get started.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              <th className="pb-1 font-medium">Title</th>
              <th className="pb-1 font-medium">Type</th>
              <th className="pb-1 font-medium">Chunks</th>
              <th className="pb-1 font-medium">Date</th>
              <th className="pb-1" />
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr
                key={doc.id}
                className="border-b border-zinc-100 dark:border-zinc-800"
              >
                <td className="py-1.5 text-zinc-900 dark:text-zinc-100 max-w-[260px]">
                  <div className="truncate">{doc.title}</div>
                  {doc.slug && (
                    <div className="truncate font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                      {doc.slug}
                    </div>
                  )}
                </td>
                <td className="py-1.5 text-zinc-500 dark:text-zinc-400">
                  {doc.sourceType}
                </td>
                <td className="py-1.5 text-zinc-500 dark:text-zinc-400">
                  {doc.chunkCount}
                </td>
                <td className="py-1.5 text-zinc-500 dark:text-zinc-400">
                  {new Date(doc.createdAt).toLocaleDateString()}
                </td>
                <td className="py-1.5 text-right">
                  {doc.slug && (
                    <button
                      type="button"
                      onClick={() => handleCopyCitationPrefix(doc.slug)}
                      className="mr-2 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                      title={`Copy [${doc.slug}: to clipboard`}
                    >
                      Copy citation prefix
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id)}
                    className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
