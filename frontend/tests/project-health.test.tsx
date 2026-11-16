import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

    const blockers = screen.getByText("Blockers").closest("section");
    expect(blockers).not.toBeNull();
    expect(within(blockers!).getByText("Free image-storage quota may be too small")).toBeInTheDocument();
    expect(
      within(blockers!).getByText("Reservation expiry behavior is unresolved"),
    ).toBeInTheDocument();
    expect(
      within(blockers!).getByText("Supported by the project plan and synchronized activity"),
    ).toBeInTheDocument();
    expect(within(blockers!).getByText("Project plan")).toBeInTheDocument();
    expect(within(blockers!).getByText("Deliverable")).toBeInTheDocument();
    expect(within(blockers!).getByText("Reservation flow")).toBeInTheDocument();
    expect(screen.getByText("2 unresolved blockers")).toBeInTheDocument();
    expect(screen.getByText("2 open blockers could affect this deadline")).toBeInTheDocument();
  });

  test("shows a blocker's synchronized source, context, timestamp, and source link", () => {
    renderPage({
      blockers: ["Image uploads are blocked by the storage quota"],
      blockerDetails: [
        {
          text: "Image uploads are blocked by the storage quota",
          evidenceIds: ["activity:discord-message-1"],
          evidence: [
            {
              evidenceId: "activity:discord-message-1",
              evidenceType: "activity",
              title: "The free storage quota was reached during upload testing",
              status: null,
              source: "discord",
              activityKind: "message",
              occurredAt: "2026-10-28T10:00:00Z",
              dueAt: null,
              url: "https://discord.com/channels/guild/channel/message",
            },
          ],
        },
      ],
    });

    const blocker = screen
      .getByText("Image uploads are blocked by the storage quota")
      .closest("article");
    expect(blocker).not.toBeNull();
    expect(within(blocker!).getByText("Discord")).toBeInTheDocument();
    expect(within(blocker!).getByText(/free storage quota was reached/)).toBeInTheDocument();
    expect(within(blocker!).getByText("2 hours ago")).toBeInTheDocument();
    expect(within(blocker!).getByRole("link", { name: "View source" })).toHaveAttribute(
      "href",
      "https://discord.com/channels/guild/channel/message",
    );
  });

  test("shows an empty state when there are no blockers", () => {
    renderPage({ blockers: [], blockerDetails: [] });

    expect(screen.getByText("No supported blockers found.")).toBeInTheDocument();
    expect(screen.queryByText(/could affect this deadline/)).not.toBeInTheDocument();
  });

  test("does not claim there are no blockers when analysis is unavailable", () => {
    renderPage({ blockers: [], blockerDetails: [], analysisStatus: "unavailable" });

    expect(screen.getByText("No blocker analysis is available yet.")).toBeInTheDocument();
    expect(screen.queryByText("No supported blockers found.")).not.toBeInTheDocument();
  });

  test("shows only GitHub items under recent GitHub work", () => {
    renderPage();

    const githubWork = screen.getByText("Recent GitHub work").closest("section");
    expect(githubWork).not.toBeNull();
    expect(
      within(githubWork!).getByText("feat: add listing image upload and preview"),
    ).toBeInTheDocument();
    expect(within(githubWork!).getByText("fix: validate campus email domain")).toBeInTheDocument();
    expect(screen.getByText("2 GitHub updates")).toBeInTheDocument();
  });

  test("shows Discord messages separately from GitHub work", () => {
    renderPage();

    expect(screen.getByText("Image uploads are blocked on the storage quota")).toBeInTheDocument();
    expect(screen.getByText("1 Discord message")).toBeInTheDocument();
    expect(screen.getByText("Recent Discord messages")).toBeInTheDocument();
  });

  test("shows an empty state when there are no Discord messages", () => {
    renderPage({
      recentActivity: mockDashboard.recentActivity.filter((item) => item.source !== "discord"),
    });

    expect(screen.getByText("No recent Discord messages.")).toBeInTheDocument();
    expect(screen.queryByText("Image uploads are blocked on the storage quota")).not.toBeInTheDocument();
  });

  test("shows an empty state when there is no GitHub activity", () => {
    renderPage({
      recentActivity: mockDashboard.recentActivity.filter((item) => item.source !== "github"),
    });

    expect(screen.getByText("No recent GitHub activity.")).toBeInTheDocument();
  });

  test("shows suggested next steps and the latest summary", () => {
    renderPage();

    const nextSteps = screen.getByText("Suggested next steps").closest("section");
    expect(nextSteps).not.toBeNull();
    expect(
      within(nextSteps!).getByText("Recommended actions supported by current project evidence"),
    ).toBeInTheDocument();
    expect(
      within(nextSteps!).getByText("Assign a decision owner for reservation expiry"),
    ).toBeInTheDocument();
    expect(within(nextSteps!).getByText("Choose image storage by tomorrow")).toBeInTheDocument();
    expect(within(nextSteps!).getByText("Reservation flow")).toBeInTheDocument();
    expect(within(nextSteps!).getByText("Deliverable · In progress")).toBeInTheDocument();
    expect(within(nextSteps!).getByText("GitHub · 20 days ago")).toBeInTheDocument();
    expect(screen.getByText(/checkout is now the critical path/)).toBeInTheDocument();
  });

  test("shows a next step's synchronized source, context, timestamp, and source link", () => {
    renderPage({
      nextSteps: ["Review the deployment discussion"],
      nextStepDetails: [
        {
          text: "Review the deployment discussion",
          evidenceIds: ["activity:discord-message-2"],
          evidence: [
            {
              evidenceId: "activity:discord-message-2",
              evidenceType: "activity",
              title: "The team still needs to choose a deployment owner",
              status: null,
              source: "discord",
              activityKind: "message",
              occurredAt: "2026-10-28T11:00:00Z",
              dueAt: null,
              url: "https://discord.com/channels/guild/channel/message-2",
            },
          ],
        },
      ],
    });

    const nextStep = screen.getByText("Review the deployment discussion").closest("article");
    expect(nextStep).not.toBeNull();
    expect(within(nextStep!).getByText(/team still needs to choose/)).toBeInTheDocument();
    expect(within(nextStep!).getByText("Discord · 1 hour ago")).toBeInTheDocument();
    expect(within(nextStep!).getByRole("link", { name: "View source" })).toHaveAttribute(
      "href",
      "https://discord.com/channels/guild/channel/message-2",
    );
  });

  test("shows an empty state when there are no supported next steps", () => {
    renderPage({ nextSteps: [], nextStepDetails: [] });

    expect(screen.getByText("No supported next steps found.")).toBeInTheDocument();
  });

  test("does not claim there are no next steps when analysis is unavailable", () => {
    renderPage({ nextSteps: [], nextStepDetails: [], analysisStatus: "unavailable" });

    expect(screen.getByText("No next-step analysis is available yet.")).toBeInTheDocument();
    expect(screen.queryByText("No supported next steps found.")).not.toBeInTheDocument();
  });

  test("keeps stale analysis visible and labels the health score as using last-known blockers", () => {
    renderPage({ analysisStatus: "stale" });

    expect(screen.getByRole("status")).toHaveTextContent("Analysis is out of date");
    expect(screen.getByText("Uses last known blockers; refresh summary")).toBeInTheDocument();
    expect(screen.getByText("Free image-storage quota may be too small")).toBeInTheDocument();
    expect(screen.getByText("Assign a decision owner for reservation expiry")).toBeInTheDocument();
  });

  test("identifies stale and failed integration limitations in the summary", () => {
    renderPage({
      analysisStatus: "stale",
      integrations: [
        {
          provider: "github",
          status: "stale",
          lastSuccessfulSyncAt: "2026-10-27T12:00:00Z",
        },
        { provider: "discord", status: "failed", lastSuccessfulSyncAt: null },
      ],
    });

    const warning = screen.getByRole("status");
    expect(within(warning).getByText("Data limitations")).toBeInTheDocument();
    expect(within(warning).getByText("GitHub data is stale. Last successful sync was 1 day ago."))
      .toBeInTheDocument();
    expect(within(warning).getByText("Discord synchronization failed.")).toBeInTheDocument();
    expect(screen.queryByText(/Analysis is out of date after newer project data/)).not.toBeInTheDocument();
  });

  test("identifies an integration that is not connected", () => {
    renderPage({
      integrations: mockDashboard.integrations.filter((item) => item.provider === "github"),
    });

    expect(screen.getByText("Discord is not connected.")).toBeInTheDocument();
  });

  test("does not show data limitations while all integrations are healthy", () => {
    renderPage();

    expect(screen.queryByText("Data limitations")).not.toBeInTheDocument();
  });

  test("shows when the latest LLM-generated summary was generated", () => {
    renderPage();

    expect(screen.getByText("Generated 19 days ago")).toBeInTheDocument();
  });

  test("condenses the stored analysis into a short executive summary", () => {
    renderPage({
      latestSummary: {
        ...mockDashboard.latestSummary!,
        text: `Recent progress:
- The deliverable 'Connect project health frontend' is in progress. [Evidence: deliverable:progress]

Upcoming milestones:
- The milestone 'MVP' is in progress and due on 2026-12-01T17:00:00Z. [Evidence: milestone:mvp]

Notable activity:
- The team merged its dashboard API work. [Evidence: activity:dashboard-api]

Blockers:
- Production database credentials are missing. [Evidence: deliverable:credentials]

Next steps:
- Resolve the production database credentials blocker. [Evidence: deliverable:credentials]

Limitations:
- GitHub integration is not connected.`,
      },
    });

    expect(
      screen.getByText(
        "The deliverable 'Connect project health frontend' is in progress. The milestone 'MVP' is in progress and due on December 1, 2026. The team merged its dashboard API work.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/2026-12-01T17:00:00Z/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Evidence:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Recent progress:")).not.toBeInTheDocument();
    expect(screen.queryByText("Production database credentials are missing.")).not.toBeInTheDocument();
    expect(screen.queryByText("GitHub integration is not connected.")).not.toBeInTheDocument();
  });

  test("treats small API and browser clock differences as generated just now", () => {
    renderPage({
      latestSummary: {
        ...mockDashboard.latestSummary!,
        generatedAt: "2026-10-28T12:00:30Z",
      },
    });

    expect(screen.getByText("Generated just now")).toBeInTheDocument();
  });

  test("generates a summary when none exists", () => {
    const onGenerateSummary = vi.fn();
    render(
      <ProjectHealth
        dashboard={{ ...mockDashboard, latestSummary: null }}
        onGenerateSummary={onGenerateSummary}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate summary" }));

    expect(onGenerateSummary).toHaveBeenCalledOnce();
  });

  test("offers to refresh an existing summary", () => {
    render(<ProjectHealth dashboard={mockDashboard} onGenerateSummary={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Refresh summary" })).toBeInTheDocument();
  });

  test("disables summary generation while a request is running", () => {
    const onGenerateSummary = vi.fn();
    render(
      <ProjectHealth
        dashboard={mockDashboard}
        onGenerateSummary={onGenerateSummary}
        isGenerating
      />,
    );

    const button = screen.getByRole("button", { name: "Generating…" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onGenerateSummary).not.toHaveBeenCalled();
  });

  test("keeps the previous summary visible when refreshing fails", () => {
    render(
      <ProjectHealth
        dashboard={mockDashboard}
        onGenerateSummary={vi.fn()}
        summaryError="The summary could not be generated. Please try again."
      />,
    );

    expect(screen.getByText(/checkout is now the critical path/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The summary could not be generated. Please try again.",
    );
  });

  test("shows an empty state instead of all complete when there are no milestones", () => {
    renderPage({ project: { ...mockDashboard.project, milestones: [] } });

    expect(screen.getByText("No milestones yet")).toBeInTheDocument();
    expect(screen.getByText("Add milestones to the project plan")).toBeInTheDocument();
    expect(screen.queryByText("All complete")).not.toBeInTheDocument();
  });

  test.todo("shows each contributor's recent commits and pull requests");
  test.todo("shows recent GitHub and Discord activity under the correct feature");
  test.todo("updates the displayed analysis for the selected date range");
  test.todo("opens the supporting evidence for summaries and health signals");
  test.todo("shows stale integration warnings");
  test.todo("shows synchronization progress and prevents duplicate sync requests");
});
