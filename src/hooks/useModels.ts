"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Model } from "@/lib/types";

export function useModels() {
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/models");
      if (!res.ok) {
        throw new Error("Failed to fetch models");
      }
      const json = await res.json();
      if (!cancelledRef.current) {
        setModels(json.data ?? []);
        setError(null);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch models");
      }
    } finally {
      if (!cancelledRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    refetch();
    return () => {
      cancelledRef.current = true;
    };
  }, [refetch]);

  return { models, isLoading, error, refetch };
}
