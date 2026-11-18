import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import AppShell from "@/components/AppShell/AppShell";
import type { NavKey } from "@/components/Sidebar/Sidebar";

const projects = [
  { id: "p1", name: "Campus Cart" },
  { id: "p2", name: "Study Buddy" },
];

function renderWithProjects(activeNav: NavKey = "milestones") {
  return render(
    <AppShell activeNav={activeNav} projectId="p1" projectName="Campus Cart" projects={projects}>
      content
    </AppShell>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-17T18:00:00Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

  test("only shows pages that exist", () => {
    render(<AppShell activeNav="health">content</AppShell>);

    expect(screen.queryByText("Pull requests")).not.toBeInTheDocument();
    expect(screen.queryByText("Team context")).not.toBeInTheDocument();
  });

  test("displays the current project and integration connection statuses", () => {
    const { container } = render(
      <AppShell
        activeNav="health"
        projectName="Campus Cart"
        integrations={[
          {
            provider: "github",
            status: "healthy",
            lastSuccessfulSyncAt: "2026-11-17T17:48:00Z",
          },
          {
            provider: "discord",
            status: "stale",
            lastSuccessfulSyncAt: "2026-11-15T18:00:00Z",
          },
        ]}
      >
        content
      </AppShell>,
    );

    expect(screen.getByText("Campus Cart")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("Synced 12 minutes ago")).toBeInTheDocument();
    expect(screen.getByText("Stale")).toBeInTheDocument();
    expect(screen.getByText("Last successful sync 2 days ago")).toBeInTheDocument();
    expect(container.querySelector('img[src*="dot-6-green"]')).toBeInTheDocument();
    expect(container.querySelector('img[src*="dot-6-amber"]')).toBeInTheDocument();
  });

  test("shows when a connected integration has never synced successfully", () => {
    render(
      <AppShell
        activeNav="health"
        projectName="Campus Cart"
        integrations={[{ provider: "discord", status: "connected", lastSuccessfulSyncAt: null }]}
      >
        content
      </AppShell>,
    );

    expect(screen.getByText("Connected", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Not synced yet")).toBeInTheDocument();
  });

  test("shows placeholders when no project is selected", () => {
    render(<AppShell activeNav="milestones">content</AppShell>);

    expect(screen.getByText("No project selected")).toBeInTheDocument();
    expect(screen.getByText("None connected")).toBeInTheDocument();
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

  test("keeps the selected project in the Health and Milestones links", () => {
    renderWithProjects();

    expect(screen.getByRole("link", { name: "Health" })).toHaveAttribute("href", "/health?project=p1");
    expect(screen.getByRole("link", { name: "Milestones" })).toHaveAttribute("href", "/milestones?project=p1");
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/projects");
  });

  test("opens the project switcher with the current project marked", () => {
    renderWithProjects();
    const toggle = screen.getByRole("button", { name: "Campus Cart" });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Study Buddy" })).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Campus Cart" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Study Buddy" })).not.toHaveAttribute("aria-current");
  });

  test.each<[NavKey, string]>([
    ["milestones", "/milestones?project=p2"],
    ["health", "/health?project=p2"],
    ["projects", "/health?project=p2"],
  ])("on the %s page, switching opens %s", (activeNav, href) => {
    renderWithProjects(activeNav);

    fireEvent.click(screen.getByRole("button", { name: "Campus Cart" }));

    expect(screen.getByRole("link", { name: "Study Buddy" })).toHaveAttribute("href", href);
  });

  test("closes the project switcher on Escape, outside clicks, and after a choice", () => {
    renderWithProjects();
    const toggle = screen.getByRole("button", { name: "Campus Cart" });

    fireEvent.click(toggle);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("link", { name: "Study Buddy" })).not.toBeInTheDocument();

    fireEvent.click(toggle);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("link", { name: "Study Buddy" })).not.toBeInTheDocument();

    fireEvent.click(toggle);
    const choice = screen.getByRole("link", { name: "Study Buddy" });
    // jsdom can't navigate between documents
    choice.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(choice);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
