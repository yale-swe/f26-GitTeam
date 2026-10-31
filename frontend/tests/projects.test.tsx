import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import ProjectsOverview from "@/components/ProjectsOverview/ProjectsOverview";
import { mockDashboard } from "@/lib/mockDashboard";

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
    expect(within(card).getByText("Oct 18")).toBeInTheDocument();
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

    expect(screen.getByRole("link", { name: /Campus Cart/ })).toHaveAttribute("href", "/health");
  });

  test("starts project onboarding from the New project action", () => {
    render(<ProjectsOverview dashboards={[mockDashboard]} />);

    expect(screen.getByRole("link", { name: "New project" })).toHaveAttribute("href", "/projects/new");
  });

  test("shows an empty state when there are no projects", () => {
    render(<ProjectsOverview dashboards={[]} />);

    expect(screen.getByText("No projects yet. Create one to get started.")).toBeInTheDocument();
  });

  test.todo("displays projects returned by the backend");
  test.todo("filters projects by health status");
  test.todo("shows contributors for each project");
  test.todo("handles loading and API error states");
});
