"use client";

import { useEffect, useState } from "react";

export type ApiDataState<T> =
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; data: T };

/**
 * Runs `load` once when the component appears and tracks its progress.
 * `load` must be defined outside the component, so it doesn't change on every render.
 * When `load` does change (e.g. a `useCallback` with new deps), the state goes back to loading.
 */
export function useApiData<T>(load: () => Promise<T>): ApiDataState<T> {
    const [result, setResult] = useState<{ load: () => Promise<T>; state: ApiDataState<T> } | null>(null);

    useEffect(() => {
        // Ignore results that arrive after the user has left the page
        let cancelled = false;
        load()
            .then((data) => {
                if (!cancelled) setResult({ load, state: { status: "ready", data } });
            })
            .catch(() => {
                if (!cancelled) setResult({ load, state: { status: "error" } });
            });
        return () => {
            cancelled = true;
        };
    }, [load]);

    return result && result.load === load ? result.state : { status: "loading" };
}
