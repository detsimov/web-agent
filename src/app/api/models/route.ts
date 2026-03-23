import { AppError } from "@/lib/error/AppError";

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedData: unknown = null;
let cachedAt = 0;

export async function GET() {
  try {
    const now = Date.now();

    if (cachedData && now - cachedAt < CACHE_TTL_MS) {
      return Response.json(cachedData);
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

    const json = await response.json();
    cachedData = json;
    cachedAt = now;

    return Response.json(json);
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
