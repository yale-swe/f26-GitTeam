import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import ProjectsOverview from "@/components/ProjectsOverview/ProjectsOverview";
import { mockDashboard } from "@/lib/mockDashboard";
import type { Dashboard } from "@/lib/types";

// Build a dashboard for one project with its own id, name, health, milestones, and blockers.
function makeDashboard(
  id: string,
  name: string,
  overrides: Partial<Dashboard> & { milestones?: Dashboard["project"]["milestones"] } = {},
): Dashboard {
  const { milestones = mockDashboard.project.milestones, ...rest } = overrides;
  return {
    ...mockDashboard,
    project: { ...mockDashboard.project, id, name, milestones },
    ...rest,
  };
}

function milestone(title: string, dueAt: string, status: "planned" | "completed" = "planned") {
  return { ...mockDashboard.project.milestones[0], id: title, title, dueAt, status };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Projects page", () => {
  test("shows each project's health, progress, next milestone, and deadline", () => {
    render(<ProjectsOverview dashboards={[mockDashboard]} />);
    const card = screen.getByRole("link", { name: /Campus Cart/ });
    expect(within(card).getByText("Campus Cart")).toBeInTheDocument();
    expect(within(card).getByText("CC")).toBeInTheDocument();
    expect(within(card).getByText("Needs attention")).toBeInTheDocument();
    expect(within(card).getByText("50%")).toBeInTheDocument();
    expect(within(card).getByText("Beta checkout")).toBeInTheDocument();
    expect(within(card).getByText("Oct 18, 2026")).toBeInTheDocument();
  });

  test("shows recent activity and blockers for each project", () => {
    render(<ProjectsOverview dashboards={[mockDashboard]} />);

    expect(screen.getByText("2 GitHub updates · 2 open blockers")).toBeInTheDocument();
  });

  test("shows portfolio totals from the project data", () => {
    render(<ProjectsOverview dashboards={[mockDashboard]} />);

    expect(screen.getByText("In your workspace").previousSibling).toHaveTextContent("1"); // active projects
    expect(screen.getByText("At risk or blocked").previousSibling).toHaveTextContent("1"); // needs review
    expect(screen.getByText("Across all projects").previousSibling).toHaveTextContent("2"); // open blockers
  });

  test("opens the project's health page from its card", () => {
    render(<ProjectsOverview dashboards={[mockDashboard]} />);

    expect(screen.getByRole("link", { name: /Campus Cart/ })).toHaveAttribute("href", "/health?project=00000000-0000-0000-0000-000000000001");
  });

  test("starts project onboarding from the New project action", () => {
    render(<ProjectsOverview dashboards={[mockDashboard]} />);

    expect(screen.getByRole("link", { name: "New project" })).toHaveAttribute("href", "/projects/new");
  });

  test("shows an empty state when there are no projects", () => {
    render(<ProjectsOverview dashboards={[]} />);

    expect(screen.getByText("No projects yet. Create one to get started.")).toBeInTheDocument();
  });

  test("shows All projects in the sidebar switcher and lists every project", () => {
    const other = { ...mockDashboard, project: { ...mockDashboard.project, id: "p2", name: "TrailMate" } };
    render(<ProjectsOverview dashboards={[mockDashboard, other]} />);
    expect(screen.getByText("Viewing")).toBeInTheDocument();
    expect(screen.queryByText("Current project")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "All projects" }));

    const menu = screen.getByRole("list", { name: "Switch project" });
    expect(within(menu).getByRole("link", { name: "Campus Cart" })).toHaveAttribute(
      "href",
      "/health?project=00000000-0000-0000-0000-000000000001",
    );
    expect(within(menu).getByRole("link", { name: "TrailMate" })).toHaveAttribute("href", "/health?project=p2");
  });

  test("hides the sidebar's connected integrations because they belong to one project", () => {
    render(<ProjectsOverview dashboards={[mockDashboard]} />);

    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
  });

  test("compares healthy, at-risk, and overdue projects side by side", () => {
    const trailMate = makeDashboard("p1", "TrailMate", {
      overallHealth: "healthy",
      blockers: [],
      milestones: [milestone("Trail browser", "2026-11-13T00:00:00Z")],
    });
    const labQueue = makeDashboard("p2", "LabQueue", {
      overallHealth: "at_risk",
      blockers: [],
      milestones: [milestone("Queue MVP", "2026-10-31T00:00:00Z")],
    });
    const dormFix = makeDashboard("p3", "DormFix", {
      overallHealth: "blocked",
      blockers: ["SSO not approved", "Storage quota", "Sensor budget"],
      milestones: [milestone("Login + report form", "2026-10-20T00:00:00Z")],
    });
    render(<ProjectsOverview dashboards={[trailMate, labQueue, dormFix]} />);

    expect(screen.getByText("In your workspace").previousSibling).toHaveTextContent("3");
    expect(screen.getByText("Healthy right now").previousSibling).toHaveTextContent("1");
    expect(screen.getByText("At risk or blocked").previousSibling).toHaveTextContent("2");
    expect(screen.getByText("Across all projects").previousSibling).toHaveTextContent("3");

    const trailCard = screen.getByRole("link", { name: /TrailMate/ });
    const dormCard = screen.getByRole("link", { name: /DormFix/ });
    expect(within(trailCard).getByText("Nov 13, 2026").className).not.toMatch(/overdue/);
    expect(within(dormCard).getByText("Oct 20, 2026").className).toMatch(/overdue/);
    expect(within(dormCard).getByText(/3 open blockers/)).toBeInTheDocument();
    expect(within(trailCard).getByText(/0 open blockers/)).toBeInTheDocument();
    expect(dormCard).toHaveAttribute("href", "/health?project=p3");
  });

  test("shows all complete when every milestone is done", () => {
    const done = makeDashboard("p1", "Done Project", {
      milestones: [
        milestone("First", "2026-10-01T00:00:00Z", "completed"),
        milestone("Second", "2026-10-10T00:00:00Z", "completed"),
      ],
    });
    render(<ProjectsOverview dashboards={[done]} />);

    const card = screen.getByRole("link", { name: /Done Project/ });
    expect(within(card).getByText("100%")).toBeInTheDocument();
    expect(within(card).getByText("All complete")).toBeInTheDocument();
    expect(within(card).getByText("—")).toBeInTheDocument();
  });

  test("shows a new project with no milestones or activity yet", () => {
    const fresh = makeDashboard("p1", "Fresh Project", { milestones: [], recentActivity: [] });
    render(<ProjectsOverview dashboards={[fresh]} />);

    const card = screen.getByRole("link", { name: /Fresh Project/ });
    expect(within(card).getByText("0%")).toBeInTheDocument();
    expect(within(card).getByText("No activity yet")).toBeInTheDocument();
    expect(within(card).getByText("No milestones yet")).toBeInTheDocument();
  });

  test.todo("displays projects returned by the backend");
  test.todo("filters projects by health status");
  test.todo("shows contributors for each project");
  test.todo("handles loading and API error states");
});

