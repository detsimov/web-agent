"use client";

import { useEffect, useState } from "react";
import type { Model } from "@/lib/types";

export function useModels() {
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchModels() {
      try {
        const res = await fetch("/api/models");
        if (!res.ok) {
          throw new Error("Failed to fetch models");
        }
        const json = await res.json();
        if (!cancelled) {
          setModels(json.data ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch models",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchModels();
    return () => {
      cancelled = true;
    };
  }, []);

  return { models, isLoading, error };
}
