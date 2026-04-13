"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import type { ApiListResponse } from "@/types";

type QueryState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

function unwrapListResponse<T>(payload: T | ApiListResponse<T>) {
  if (payload && typeof payload === "object" && "results" in payload && Array.isArray(payload.results)) {
    return payload.results as T;
  }

  return payload as T;
}

export function useAuthedQuery<T>(path: string, options?: { enabled?: boolean; initialData?: T | null }) {
  const { hydrated, session, logout } = useAuth();
  const enabled = options?.enabled ?? true;
  const initialData = options?.initialData ?? null;
  const [state, setState] = useState<QueryState<T>>({
    data: initialData,
    error: null,
    loading: Boolean(enabled),
  });

  const load = useCallback(async () => {
    if (!hydrated || !enabled || !session?.accessToken) {
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const payload = await apiRequest<T | ApiListResponse<T>>(path, {
        method: "GET",
        token: session.accessToken,
      });

      startTransition(() => {
        setState({
          data: unwrapListResponse<T>(payload),
          error: null,
          loading: false,
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load data.";
      if (message.toLowerCase().includes("token")) {
        logout();
      }
      setState({
        data: initialData,
        error: message,
        loading: false,
      });
    }
  }, [enabled, hydrated, initialData, logout, path, session?.accessToken]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    load();
  }, [enabled, hydrated, load, path, session?.accessToken]);

  return {
    ...state,
    refetch: load,
  };
}
