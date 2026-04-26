import { AppError } from "@/lib/error/AppError";
import {
  getOllamaBaseUrl,
  invalidateLocalModelList,
  listOllamaModels,
} from "@/lib/ollama";
import type { Model } from "@/lib/types";

const CACHE_TTL_MS = 5 * 60 * 1000;

type CloudResponse = { data: Model[] } & Record<string, unknown>;

let cloudCache: { data: CloudResponse; ts: number } | null = null;
const localCacheByUrl = new Map<string, { data: Model[]; ts: number }>();

async function fetchCloudModels(): Promise<CloudResponse> {
  const now = Date.now();
  if (cloudCache && now - cloudCache.ts < CACHE_TTL_MS) {
    return cloudCache.data;
  }

  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      Authorization: `Bearer ${process.env.OPEN_ROUTER_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new AppError(
      "Failed to fetch models from OpenRouter",
      response.status,
      "MODELS_FETCH_ERROR",
    );
  }

  const json = (await response.json()) as CloudResponse;
  cloudCache = { data: json, ts: now };
  return json;
}

async function fetchLocalModelsCached(baseUrl: string): Promise<Model[]> {
  const now = Date.now();
  const cached = localCacheByUrl.get(baseUrl);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await listOllamaModels(baseUrl);
  localCacheByUrl.set(baseUrl, { data, ts: now });
  return data;
}

export function invalidateLocalCache(baseUrl?: string): void {
  if (baseUrl) {
    localCacheByUrl.delete(baseUrl);
  } else {
    localCacheByUrl.clear();
  }
  invalidateLocalModelList(baseUrl);
}

export async function GET() {
  try {
    const localBaseUrl = await getOllamaBaseUrl();

    const [cloudResult, localResult] = await Promise.allSettled([
      fetchCloudModels(),
      localBaseUrl
        ? fetchLocalModelsCached(localBaseUrl)
        : Promise.resolve<Model[]>([]),
    ]);

    if (cloudResult.status === "rejected") {
      const err = cloudResult.reason;
      if (err instanceof AppError) {
        return Response.json(
          { error: err.message, code: err.code },
          { status: err.status },
        );
      }
      return Response.json(
        { error: "Failed to fetch models" },
        { status: 500 },
      );
    }

    let localModels: Model[] = [];
    if (localResult.status === "fulfilled") {
      localModels = localResult.value;
    } else {
      const err = localResult.reason;
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.warn(`[models] local fetch failed: ${msg}`);
    }

    const cloud = cloudResult.value;
    const merged: CloudResponse = {
      ...cloud,
      data: [...localModels, ...(cloud.data ?? [])],
    };

    return Response.json(merged);
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return Response.json({ error: "Failed to fetch models" }, { status: 500 });
  }
}
