import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { useApiData } from "@/lib/useApiData";

describe("useApiData", () => {
  test("goes back to loading when the load function changes", async () => {
    const loadA = () => Promise.resolve("a");
    const loadB = () => new Promise<string>(() => {});

    const { result, rerender } = renderHook(({ load }) => useApiData(load), {
      initialProps: { load: loadA },
    });

    expect(result.current).toEqual({ status: "loading" });
    await waitFor(() => expect(result.current).toEqual({ status: "ready", data: "a" }));

    rerender({ load: loadB });

    expect(result.current).toEqual({ status: "loading" });
  });

  test("reports an error when loading fails", async () => {
    const { result } = renderHook(() => useApiData(failingLoad));

    await waitFor(() => expect(result.current).toEqual({ status: "error" }));
  });
});

function failingLoad() {
  return Promise.reject(new Error("API 500"));
}
