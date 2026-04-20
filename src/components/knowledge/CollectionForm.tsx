"use client";

import { useEffect, useState } from "react";
import type { RagCollection } from "@/lib/rag/types";

type Props = {
  collection?: RagCollection;
  onClose: () => void;
  onCreated: () => Promise<void>;
};

type EmbeddingModel = {
  id: string;
  name?: string;
  context_length?: number;
  // biome-ignore lint: raw API response may include untyped fields
  architecture?: any;
};

const KNOWN_DIMENSIONS: Record<string, number> = {
  "openai/text-embedding-3-small": 1536,
  "openai/text-embedding-3-large": 3072,
  "openai/text-embedding-ada-002": 1536,
  "google/text-embedding-004": 768,
  "cohere/embed-english-v3.0": 1024,
  "cohere/embed-multilingual-v3.0": 1024,
  "cohere/embed-english-light-v3.0": 384,
  "cohere/embed-multilingual-light-v3.0": 384,
  "mistralai/mistral-embed": 1024,
};

function getDimensions(model: EmbeddingModel): number | null {
  // Try raw API response fields
  const arch = model.architecture;
  if (arch?.output_dimensions) return arch.output_dimensions;
  if (arch?.outputDimensions) return arch.outputDimensions;
  // biome-ignore lint: raw API field
  if ((model as any).dimensions) return (model as any).dimensions;
  // Fallback to known map
  return KNOWN_DIMENSIONS[model.id] ?? null;
}

export function CollectionForm({ collection, onClose, onCreated }: Props) {
  const isEdit = !!collection;
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [embeddingModel, setEmbeddingModel] = useState(
    collection?.embeddingModel ?? "",
  );
  const [embeddingDimensions, setEmbeddingDimensions] = useState(
    collection?.embeddingDimensions ?? 1536,
  );
  const [chunkingStrategy, setChunkingStrategy] = useState(
    collection?.chunkingStrategy ?? "recursive",
  );
  const [chunkSize, setChunkSize] = useState(1000);
  const [overlap, setOverlap] = useState(200);
  const [sentences, setSentences] = useState(5);

  const [clarificationMode, setClarificationMode] = useState<"soft" | "strict">(
    collection?.clarificationMode ?? "soft",
  );
  const [rerankEnabled, setRerankEnabled] = useState(
    collection?.rerankEnabled ?? true,
  );
  const [rerankModel, setRerankModel] = useState(
    collection?.rerankModel ?? "cohere/rerank-4-pro",
  );
  const [rerankTopNInput, setRerankTopNInput] = useState(
    collection?.rerankTopNInput ?? 15,
  );
  const [vectorThreshold, setVectorThreshold] = useState(
    collection?.vectorThreshold ?? 0.3,
  );
  const [rerankThreshold, setRerankThreshold] = useState(
    collection?.rerankThreshold ?? 0.3,
  );
  const [rerankModels, setRerankModels] = useState<string[]>([
    "cohere/rerank-4-pro",
  ]);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [models, setModels] = useState<EmbeddingModel[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/rag/embedding-models")
      .then((r) => r.json())
      .then((data) => {
        const list: EmbeddingModel[] = data?.data ?? data ?? [];
        setModels(list);
        if (list.length > 0) {
          setEmbeddingModel((prev) => {
            if (prev) return prev;
            const first = list[0];
            const dims = getDimensions(first);
            if (dims) setEmbeddingDimensions(dims);
            return first.id;
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/rag/rerank-models")
      .then((r) => r.json())
      .then((data) => {
        const list: Array<{ id: string }> = data?.data ?? data ?? [];
        const ids = list
          .map((m) => m.id)
          .filter(
            (id): id is string => typeof id === "string" && id.length > 0,
          );
        if (ids.length > 0) {
          setRerankModels(ids);
        }
      })
      .catch(() => {});
  }, []);

  function handleModelChange(modelId: string) {
    setEmbeddingModel(modelId);
    const model = models.find((m) => m.id === modelId);
    if (model) {
      const dims = getDimensions(model);
      if (dims) setEmbeddingDimensions(dims);
    }
  }

  // Parse existing chunking config
  useEffect(() => {
    if (!collection?.chunkingConfig) return;
    const cfg = collection.chunkingConfig as Record<string, number>;
    if (cfg.chunkSize) setChunkSize(cfg.chunkSize);
    if (cfg.overlap) setOverlap(cfg.overlap);
    if (cfg.sentences) setSentences(cfg.sentences);
  }, [collection]);

  function buildChunkingConfig() {
    switch (chunkingStrategy) {
      case "fixed":
        return { chunkSize, overlap };
      case "sentence":
        return { sentences };
      case "recursive":
        return { chunkSize, overlap };
      case "markdown":
        return {};
      default:
        return {};
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const body = {
      name,
      description,
      embeddingModel,
      embeddingDimensions,
      chunkingStrategy,
      chunkingConfig: buildChunkingConfig(),
      clarificationMode,
      vectorThreshold,
      rerankEnabled,
      rerankModel,
      rerankTopNInput,
      rerankThreshold,
    };

    try {
      const url = isEdit
        ? `/api/rag/collections/${collection.id}`
        : "/api/rag/collections";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save");
        return;
      }

      await onCreated();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {isEdit ? "Edit Collection" : "New Collection"}
        </h3>

        {error && (
          <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Description
          </span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Embedding Model
          </span>
          <select
            value={embeddingModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
            Dimensions: {embeddingDimensions}
          </span>
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Chunking Strategy
          </span>
          <select
            value={chunkingStrategy}
            onChange={(e) =>
              setChunkingStrategy(e.target.value as typeof chunkingStrategy)
            }
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="fixed">Fixed Size</option>
            <option value="sentence">Sentence</option>
            <option value="recursive">Recursive</option>
            <option value="markdown">Markdown</option>
          </select>
        </label>

        {(chunkingStrategy === "fixed" || chunkingStrategy === "recursive") && (
          <div className="mb-3 flex gap-3">
            <label className="flex-1">
              <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Chunk Size
              </span>
              <input
                type="number"
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                min={100}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Overlap
              </span>
              <input
                type="number"
                value={overlap}
                onChange={(e) => setOverlap(Number(e.target.value))}
                min={0}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
          </div>
        )}

        {chunkingStrategy === "sentence" && (
          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Sentences per Chunk
            </span>
            <input
              type="number"
              value={sentences}
              onChange={(e) => setSentences(Number(e.target.value))}
              min={1}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
        )}

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Clarification Mode
          </span>
          <select
            value={clarificationMode}
            onChange={(e) =>
              setClarificationMode(e.target.value as "soft" | "strict")
            }
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="soft">
              Soft — fall back to general knowledge with a disclaimer
            </option>
            <option value="strict">
              Strict — refuse to answer and request clarification
            </option>
          </select>
          <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
            Controls how the agent behaves when the knowledge base returns no
            results above the configured thresholds.
          </span>
        </label>

        <div className="mb-3 rounded-md border border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <span>Advanced</span>
            <span className="text-xs text-zinc-500">
              {advancedOpen ? "▾" : "▸"}
            </span>
          </button>
          {advancedOpen && (
            <div className="space-y-3 border-t border-zinc-200 px-3 py-3 dark:border-zinc-700">
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={rerankEnabled}
                  onChange={(e) => setRerankEnabled(e.target.checked)}
                />
                <span>Enable reranking</span>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Rerank Model
                </span>
                <select
                  value={rerankModel}
                  onChange={(e) => setRerankModel(e.target.value)}
                  disabled={!rerankEnabled}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {rerankModels.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Rerank Top-N Input
                </span>
                <input
                  type="number"
                  value={rerankTopNInput}
                  min={5}
                  max={50}
                  onChange={(e) =>
                    setRerankTopNInput(
                      Math.max(5, Math.min(50, Number(e.target.value))),
                    )
                  }
                  disabled={!rerankEnabled}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 flex items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  <span>Vector Threshold</span>
                  <span className="text-xs text-zinc-500">
                    {vectorThreshold.toFixed(2)}
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={vectorThreshold}
                  onChange={(e) => setVectorThreshold(Number(e.target.value))}
                  className="w-full"
                />
              </label>

              <label className="block">
                <span className="mb-1 flex items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  <span>Rerank Threshold</span>
                  <span className="text-xs text-zinc-500">
                    {rerankThreshold.toFixed(2)}
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={rerankThreshold}
                  onChange={(e) => setRerankThreshold(Number(e.target.value))}
                  disabled={!rerankEnabled}
                  className="w-full disabled:opacity-50"
                />
              </label>

              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Score distributions differ per embedding and rerank model. Use
                the search preview to calibrate thresholds empirically.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name || !embeddingModel}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : isEdit ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
