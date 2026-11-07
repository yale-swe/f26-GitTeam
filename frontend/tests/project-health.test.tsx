import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import ProjectHealth from "@/components/ProjectHealth/ProjectHealth";
import { mockDashboard } from "@/lib/mockDashboard";
import type { Dashboard } from "@/lib/types";

function renderPage(changes: Partial<Dashboard> = {}) {
  return render(<ProjectHealth dashboard={{ ...mockDashboard, ...changes }} />);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });      // freeze only the clock
  vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Project health page", () => {

  test("shows the health score from the dashboard", () => {
    renderPage(); // mock data: healthScore 65, overallHealth "at_risk"

    expect(screen.getByText("65 / 100")).toBeInTheDocument();
    expect(screen.getByText("Calculated from current project data")).toBeInTheDocument();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
  });

  test("shows the overall health status in the summary pill", () => {
    renderPage({ overallHealth: "blocked" });

    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });

  test("shows a placeholder when the score can't be calculated", () => {
    renderPage({ healthScore: null, overallHealth: "unknown" });

    expect(screen.getByText("— / 100")).toBeInTheDocument();
    expect(screen.getByText("Not enough data to calculate yet")).toBeInTheDocument();
    expect(screen.getByText("Unclear")).toBeInTheDocument();
  });

  test("treats a missing score the same as no score", () => {
    renderPage({ healthScore: undefined as unknown as null });

    expect(screen.getByText("— / 100")).toBeInTheDocument();
    expect(screen.getByText("Not enough data to calculate yet")).toBeInTheDocument();
  });

  test("shows plan progress and current milestone from the data", () => {
    render(<ProjectHealth dashboard={mockDashboard} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("2 of 4 milestones complete")).toBeInTheDocument();
    expect(screen.getByText("3 / 4")).toBeInTheDocument();
  });

  test("shows all milestones complete when nothing is left", () => {
    renderPage({
      project: {
        ...mockDashboard.project,
        milestones: mockDashboard.project.milestones.map((m) => ({ ...m, status: "completed" })),
      },
    });

    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("All complete")).toBeInTheDocument();
  });

  test("shows every milestone on the timeline with its date", () => {
    renderPage();

    expect(screen.getByText("Plan approved")).toBeInTheDocument();
    expect(screen.getByText("Sep 05")).toBeInTheDocument();
    expect(screen.getByText("Core marketplace")).toBeInTheDocument();
    expect(screen.getByText("Final release")).toBeInTheDocument();
  });

  test("shows the current milestone's progress from its deliverables", () => {
    renderPage();

    expect(screen.getByText("Beta checkout progress")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(screen.getByText(/2 deliverables remaining/)).toBeInTheDocument();
    expect(screen.getByText(/1 blocked/)).toBeInTheDocument();
  });

  test("hides milestone progress when the current milestone has no deliverables", () => {
    renderPage({ project: { ...mockDashboard.project, deliverables: [] } });

    expect(screen.queryByText("Beta checkout progress")).not.toBeInTheDocument();
  });

  test("marks the next deadline as overdue when its due date has passed", () => {
    renderPage();

    expect(screen.getByText("Overdue by 10 days")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  test("shows days left and the at-risk pill for an upcoming deadline", () => {
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z")); // before Beta checkout is due
    renderPage();

    expect(screen.getByText("due in 8 days")).toBeInTheDocument();
    expect(screen.getByText("At risk")).toBeInTheDocument();
    expect(screen.queryByText("Overdue")).not.toBeInTheDocument();
  });

  test("shows an empty state when there is no upcoming deadline", () => {
    renderPage({ upcomingDeadlines: [] });

    expect(screen.getByText("No upcoming deadline")).toBeInTheDocument();
  });

  test("lists unresolved blockers and counts them", () => {
    renderPage();

    expect(screen.getByText("Free image-storage quota may be too small")).toBeInTheDocument();
    expect(screen.getByText("Reservation expiry behavior is unresolved")).toBeInTheDocument();
    expect(screen.getByText("2 unresolved blockers")).toBeInTheDocument();
    expect(screen.getByText("2 open blockers could affect this deadline")).toBeInTheDocument();
  });

  test("shows an empty state when there are no blockers", () => {
    renderPage({ blockers: [] });

    expect(screen.getByText("No open blockers.")).toBeInTheDocument();
    expect(screen.queryByText(/could affect this deadline/)).not.toBeInTheDocument();
  });

  test("shows only GitHub items under recent GitHub work", () => {
    renderPage();

    expect(screen.getByText("feat: add listing image upload and preview")).toBeInTheDocument();
    expect(screen.getByText("fix: validate campus email domain")).toBeInTheDocument();
    expect(screen.getByText("2 GitHub updates")).toBeInTheDocument();
  });

  test("shows an empty state when there is no GitHub activity", () => {
    renderPage({
      recentActivity: mockDashboard.recentActivity.filter((item) => item.source !== "github"),
    });

    expect(screen.getByText("No recent GitHub activity.")).toBeInTheDocument();
  });

  test("shows suggested next steps and the latest summary", () => {
    renderPage();

    expect(screen.getByText("Assign a decision owner for reservation expiry")).toBeInTheDocument();
    expect(screen.getByText("Choose image storage by tomorrow")).toBeInTheDocument();
    expect(screen.getByText(/checkout is now the critical path/)).toBeInTheDocument();
  });

  test("shows an empty state instead of all complete when there are no milestones", () => {
    renderPage({ project: { ...mockDashboard.project, milestones: [] } });

    expect(screen.getByText("No milestones yet")).toBeInTheDocument();
    expect(screen.getByText("Add milestones to the project plan")).toBeInTheDocument();
    expect(screen.queryByText("All complete")).not.toBeInTheDocument();
  });

  test.todo("shows the latest LLM-generated summary with its generated time");
  test.todo("shows each contributor's recent commits and pull requests");
  test.todo("shows recent GitHub and Discord activity under the correct feature");
  test.todo("updates the displayed analysis for the selected date range");
  test.todo("opens the supporting evidence for summaries and health signals");
  test.todo("shows stale integration warnings");
  test.todo("shows synchronization progress and prevents duplicate sync requests");
});
