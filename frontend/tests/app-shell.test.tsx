import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import AppShell from "@/components/AppShell/AppShell";

afterEach(() => {
  cleanup();
});

describe("Application shell and navigation", () => {
  test("links Projects, Health, and Milestones to their pages", () => {
    render(<AppShell activeNav="health">content</AppShell>);

    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/projects");
    expect(screen.getByRole("link", { name: "Health" })).toHaveAttribute("href", "/health");
    expect(screen.getByRole("link", { name: "Milestones" })).toHaveAttribute("href", "/milestones");
  });

  test("highlights the active navigation destination", () => {
    render(<AppShell activeNav="health">content</AppShell>);

    expect(screen.getByRole("link", { name: "Health" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Projects" })).not.toHaveAttribute("aria-current");
  });

  test("does not link pages that are not built yet", () => {
    render(<AppShell activeNav="health">content</AppShell>);

    expect(screen.queryByRole("link", { name: "Pull requests" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Team context" })).not.toBeInTheDocument();
  });

  test("displays the current project and integration connection statuses", () => {
    const { container } = render(<AppShell activeNav="health">content</AppShell>);

    expect(screen.getByText("Campus Cart")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Discord")).toBeInTheDocument();
    // GitHub is healthy (green), Discord is stale (amber) in the mock data
    expect(container.querySelector('img[src*="dot-6-green"]')).toBeInTheDocument();
    expect(container.querySelector('img[src*="dot-6-amber"]')).toBeInTheDocument();
  });

  test("hides project-specific context during project onboarding", () => {
    render(
      <AppShell activeNav="projects" showProjectContext={false}>
        content
      </AppShell>,
    );

    expect(screen.queryByText("Current project")).not.toBeInTheDocument();
    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
  });
});
