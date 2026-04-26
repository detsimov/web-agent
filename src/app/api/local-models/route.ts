import * as z from "zod";
import { invalidateLocalCache } from "@/app/api/models/route";
import { AppError } from "@/lib/error/AppError";
import {
  getOllamaBaseUrl,
  listOllamaModels,
  normalizeOllamaBaseUrl,
  probeOllama,
} from "@/lib/ollama";
import { repo } from "@/lib/repository/DrizzleChatRepository";
import type { Model } from "@/lib/types";

type LocalModelsResponse = {
  baseUrl: string | null;
  status: "ok" | "error" | "unconfigured";
  error?: string;
  models: Model[];
};

async function buildResponse(): Promise<LocalModelsResponse> {
  const baseUrl = await getOllamaBaseUrl();
  if (!baseUrl) {
    return { baseUrl: null, status: "unconfigured", models: [] };
  }

  const probe = await probeOllama(baseUrl);
  if (probe.status === "error") {
    return {
      baseUrl,
      status: "error",
      error: probe.error,
      models: [],
    };
  }

  try {
    const models = await listOllamaModels(baseUrl);
    return { baseUrl, status: "ok", models };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { baseUrl, status: "error", error: msg, models: [] };
  }
}

export async function GET() {
  try {
    const body = await buildResponse();
    return Response.json(body);
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return Response.json(
      { error: "Failed to load local models" },
      {
        status: 500,
      },
    );
  }
}

const PatchSchema = z.object({
  baseUrl: z.string().nullable(),
});

export async function PATCH(request: Request) {
  try {
    const json = await request.json();
    const { baseUrl } = PatchSchema.parse(json);

    const previous = await getOllamaBaseUrl();

    if (baseUrl === null || baseUrl.trim() === "") {
      await repo.updatePersonalization({ ollamaBaseUrl: null });
      if (previous) invalidateLocalCache(previous);
      return Response.json({
        baseUrl: null,
        status: "unconfigured",
        models: [],
      } satisfies LocalModelsResponse);
    }

    const normalized = normalizeOllamaBaseUrl(baseUrl);
    await repo.updatePersonalization({ ollamaBaseUrl: normalized });

    if (previous && previous !== normalized) invalidateLocalCache(previous);
    invalidateLocalCache(normalized);

    const body = await buildResponse();
    return Response.json(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
