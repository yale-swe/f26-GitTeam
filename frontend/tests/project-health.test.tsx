import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import ProjectHealth from "@/components/ProjectHealth/ProjectHealth";
import { mockDashboard } from "@/lib/mockDashboard";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Project health page", () => {
  test("displays the health score returned by the backend", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ score: 65, status: "at_risk" }),
    } as Response);

    render(<ProjectHealth dashboard={mockDashboard} />);

    expect(screen.getByText("— / 100")).toBeInTheDocument();
    expect(await screen.findByText("65 / 100")).toBeInTheDocument();
    expect(screen.getByText("Calculated from current project data")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/health/score",
      expect.objectContaining({ method: "POST" }),
    );
  });

  test.todo("shows the correct on-track, needs-attention, or at-risk status");
  test.todo("displays upcoming deadlines and unresolved blockers");
  test.todo("shows milestone progress on the project timeline");
  test.todo("shows recent GitHub and Discord activity under the correct feature");
  test.todo("shows contributor activity and suggested next steps");
  test.todo("updates the displayed analysis for the selected date range");
  test.todo("opens the supporting evidence for summaries and health signals");
  test.todo("handles loading, empty, stale, and API error states");
  test.todo("shows synchronization progress and prevents duplicate sync requests");
});
