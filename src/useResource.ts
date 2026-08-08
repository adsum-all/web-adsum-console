import { useCallback, useEffect, useState } from "react";

import { ApiError } from "./api.js";

export interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

// Load an async resource, exposing loading and error states plus a manual
// reload so list views can refresh after a mutation. Keeps each screen small.
// An optional onError callback receives the raw failure, so callers can react
// to specific statuses (e.g. a 401 that must clear the session).
export function useResource<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  onError?: (err: unknown) => void,
): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loader()
      .then((result) => {
        if (alive) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (alive) {
          setError(err instanceof ApiError ? err.message : "Erreur réseau");
          setLoading(false);
        }
        onError?.(err);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, loading, error, reload };
}
