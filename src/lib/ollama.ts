import { OpenRouter } from "@openrouter/sdk";
import { AppError } from "@/lib/error/AppError";
import { repo } from "@/lib/repository/DrizzleChatRepository";
import type { Model } from "@/lib/types";

const DEFAULT_BASE_URL = "http://localhost:11434/v1";
const PROBE_TIMEOUT_MS = 3000;
const SHOW_TIMEOUT_MS = 5000;
const SHOW_PARALLELISM = 6;
const MODEL_LIST_TTL_MS = 5 * 60 * 1000;
const FALLBACK_CONTEXT_LENGTH = 8192;

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
    digest?: string;
    modified_at?: string;
  }>;
};

type OllamaShowResponse = {
  model_info?: Record<string, unknown>;
};

type ListEntry = { data: Model[]; ts: number };
type ContextLengthEntry = { value: number };

const clientCache = new Map<string, OpenRouter>();
const listCacheByUrl = new Map<string, ListEntry>();
const contextLengthCache = new Map<string, ContextLengthEntry>();

export function normalizeOllamaBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new AppError("Empty base URL", 400, "INVALID_OLLAMA_URL");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new AppError("Malformed Ollama URL", 400, "INVALID_OLLAMA_URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError(
      "Ollama URL must use http or https",
      400,
      "INVALID_OLLAMA_URL",
    );
  }

  // Strip trailing slashes from pathname
  let path = url.pathname.replace(/\/+$/, "");
  // Ensure /v1 suffix
  if (!path.endsWith("/v1")) {
    path = `${path}/v1`;
  }
  url.pathname = path;
  // Drop search/hash if any
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/+$/, "");
}

export function rootOf(baseUrl: string): string {
  return baseUrl.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
}

export async function getOllamaBaseUrl(): Promise<string | null> {
  const personalization = await repo.loadPersonalization();
  if (personalization.ollamaBaseUrl) {
    return personalization.ollamaBaseUrl;
  }
  const fromEnv = process.env.OLLAMA_BASE_URL;
  if (fromEnv) {
    try {
      return normalizeOllamaBaseUrl(fromEnv);
    } catch {
      console.warn(`[ollama] OLLAMA_BASE_URL env var is malformed: ${fromEnv}`);
      return null;
    }
  }
  return null;
}

export function getOllamaBaseUrlOrDefault(baseUrl: string | null): string {
  return baseUrl ?? DEFAULT_BASE_URL;
}

export function getOllamaClient(baseUrl: string): OpenRouter {
  const cached = clientCache.get(baseUrl);
  if (cached) return cached;
  const client = new OpenRouter({
    apiKey: "ollama",
    serverURL: baseUrl,
    debugLogger: console,
  });
  clientCache.set(baseUrl, client);
  return client;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = PROBE_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function probeOllama(
  baseUrl: string,
): Promise<{ status: "ok" | "error"; error?: string }> {
  const tagsUrl = `${rootOf(baseUrl)}/api/tags`;
  try {
    const res = await fetchWithTimeout(tagsUrl);
    if (!res.ok) {
      return { status: "error", error: `${res.status} ${res.statusText}` };
    }
    return { status: "ok" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[ollama] probe failed for ${baseUrl}: ${msg}`);
    return { status: "error", error: msg };
  }
}

function extractContextLength(
  info: Record<string, unknown> | undefined,
): number {
  if (!info) return FALLBACK_CONTEXT_LENGTH;
  for (const [key, value] of Object.entries(info)) {
    if (typeof value === "number" && key.endsWith(".context_length")) {
      return value;
    }
  }
  return FALLBACK_CONTEXT_LENGTH;
}

async function resolveContextLength(
  baseUrl: string,
  modelName: string,
  digest: string | undefined,
): Promise<number> {
  const cacheKey = `${baseUrl}::${modelName}::${digest ?? ""}`;
  const cached = contextLengthCache.get(cacheKey);
  if (cached) return cached.value;

  const showUrl = `${rootOf(baseUrl)}/api/show`;
  try {
    const res = await fetchWithTimeout(showUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName }),
      timeoutMs: SHOW_TIMEOUT_MS,
    });
    if (!res.ok) {
      contextLengthCache.set(cacheKey, { value: FALLBACK_CONTEXT_LENGTH });
      return FALLBACK_CONTEXT_LENGTH;
    }
    const json = (await res.json()) as OllamaShowResponse;
    const value = extractContextLength(json.model_info);
    contextLengthCache.set(cacheKey, { value });
    return value;
  } catch {
    contextLengthCache.set(cacheKey, { value: FALLBACK_CONTEXT_LENGTH });
    return FALLBACK_CONTEXT_LENGTH;
  }
}

async function pmap<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    },
  );
  await Promise.all(workers);
  return out;
}

export async function listOllamaModels(baseUrl: string): Promise<Model[]> {
  const cached = listCacheByUrl.get(baseUrl);
  if (cached && Date.now() - cached.ts < MODEL_LIST_TTL_MS) {
    return cached.data;
  }

  const tagsUrl = `${rootOf(baseUrl)}/api/tags`;
  const res = await fetchWithTimeout(tagsUrl);
  if (!res.ok) {
    throw new Error(`Ollama /api/tags returned ${res.status}`);
  }
  const json = (await res.json()) as OllamaTagsResponse;
  const tags = json.models ?? [];

  const entries = await pmap(tags, SHOW_PARALLELISM, async (tag) => {
    const name = tag.name ?? "";
    if (!name) return null;
    const contextLength = await resolveContextLength(baseUrl, name, tag.digest);
    const model: Model = {
      id: `ollama/${name}`,
      name,
      context_length: contextLength,
      pricing: { prompt: "0", completion: "0" },
    };
    return model;
  });

  const data = entries.filter((m): m is Model => m !== null);
  listCacheByUrl.set(baseUrl, { data, ts: Date.now() });
  return data;
}

export function invalidateLocalModelList(baseUrl?: string): void {
  if (baseUrl) {
    listCacheByUrl.delete(baseUrl);
  } else {
    listCacheByUrl.clear();
  }
}
