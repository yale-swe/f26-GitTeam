"use client";

import { useEffect, useState } from "react";

export type ApiDataState<T> =
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; data: T };

/**
 * Runs `load` once when the component appears and tracks its progress.
 * `load` must be defined outside the component, so it doesn't change on every render.
 */
export function useApiData<T>(load: () => Promise<T>): ApiDataState<T> {
    const [state, setState] = useState<ApiDataState<T>>({ status: "loading" });

    useEffect(() => {
        // Ignore results that arrive after the user has left the page
        let cancelled = false;
        load()
            .then((data) => {
                if (!cancelled) setState({ status: "ready", data });
            })
            .catch(() => {
                if (!cancelled) setState({ status: "error" });
            });
        return () => {
            cancelled = true;
        };
    }, [load]);

    return state;
}