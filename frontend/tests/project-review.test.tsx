import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import ProjectReview from "@/components/ProjectReview/ProjectReview";
import { connectDiscord, createProject, syncDiscord } from "@/lib/api";
import { getGitHubInstallUrl } from "@/lib/github";
import { emptyDraft, type PlanDraft } from "@/lib/projectDraft";
import type { Project } from "@/lib/types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// Replace API calls with fakes; keep everything else in api.ts real.
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  createProject: vi.fn(),
  connectDiscord: vi.fn(),
  syncDiscord: vi.fn(),
}));

vi.mock("@/lib/github", () => ({
  getGitHubInstallUrl: vi.fn(),
}));

const STORAGE_KEY = "devsync.projectDraft.v1";

function completeDraft(overrides: Partial<PlanDraft> = {}): PlanDraft {
  return {
    ...emptyDraft(),
    name: "Campus Cart",
    summary: "A campus-only marketplace for students to buy and sell used textbooks.",
    features: [{ id: "f1", title: "Listings and search" }],
    milestones: [{ id: "m1", title: "Core marketplace", date: "2030-10-10" }],
    deliverables: [{ id: "d1", title: "Auth service", milestoneId: "m1" }],
    ...overrides,
  };
}

function seedDraft(draft: PlanDraft) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ draft, savedAt: new Date().toISOString() }),
  );
}

const createdProject: Project = {
  id: "project-1",
  name: "Campus Cart",
  summary: "A campus-only marketplace.",
  features: ["Listings and search"],
  completedFeatures: [],
  deliverables: [],
  milestones: [],
};

beforeEach(() => {
  window.localStorage.clear();
  pushMock.mockReset();
  vi.mocked(createProject).mockReset();
  vi.mocked(connectDiscord).mockReset();
  vi.mocked(syncDiscord).mockReset();
  vi.mocked(getGitHubInstallUrl).mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Final project onboarding review", () => {
  test("the back arrow returns to the integrations step", () => {
    render(<ProjectReview />);

    expect(screen.getByRole("link", { name: "Back to integrations" })).toHaveAttribute(
      "href",
      "/projects/new/integrations",
    );
  });

  test("displays the complete project plan before creation", async () => {
    seedDraft(completeDraft());
    render(<ProjectReview />);

    expect(await screen.findByText("Campus Cart")).toBeInTheDocument();
    expect(screen.getByText(/campus-only marketplace/)).toBeInTheDocument();
    expect(screen.getByText("Listings and search")).toBeInTheDocument();
    const milestone = screen.getByText("Core marketplace").closest("li");
    expect(milestone).not.toBeNull();
    expect(milestone).toHaveTextContent("Auth service");
    expect(screen.getByText((_, node) => {
      const text = node?.textContent ?? "";
      return node?.tagName === "SPAN" && text.includes("10") && text.includes("2030");
    })).toBeInTheDocument();
  });

  test("displays the selected Discord channels", async () => {
    seedDraft(
      completeDraft({
        discordChannels: [
          { guildId: "g1", channelId: "c1", guildName: "Campus Cart", channelName: "dev" },
        ],
      }),
    );
    render(<ProjectReview />);

    expect(await screen.findByText("# dev")).toBeInTheDocument();
    expect(screen.getByText("Campus Cart", { selector: "span" })).toBeInTheDocument();
  });

  test("identifies incomplete setup information and blocks creation", async () => {
    seedDraft(completeDraft({ name: "", summary: "" }));
    render(<ProjectReview />);

    expect(await screen.findByText("Add a project name.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create project" })).toBeDisabled();
  });

  test("returns to an earlier onboarding step without losing data", async () => {
    seedDraft(completeDraft());
    render(<ProjectReview />);

    expect(await screen.findByText("Campus Cart")).toBeInTheDocument();
    // Draft stays in storage so navigating back keeps the reviewed plan.
    expect(screen.getByRole("link", { name: "Edit integrations" })).toHaveAttribute(
      "href",
      "/projects/new/integrations",
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  test("creates the project, attaches Discord, clears the draft, and opens project health", async () => {
    vi.mocked(createProject).mockResolvedValue(createdProject);
    vi.mocked(connectDiscord).mockResolvedValue({ provider: "discord", status: "connected" });
    vi.mocked(syncDiscord).mockResolvedValue({
      provider: "discord",
      status: "healthy",
      importedCount: 3,
    });
    seedDraft(
      completeDraft({
        discordChannels: [
          { guildId: "g1", channelId: "c1", guildName: "Campus Cart", channelName: "dev" },
        ],
      }),
    );
    render(<ProjectReview />);

    fireEvent.click(await screen.findByRole("button", { name: "Create project" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/health?project=project-1"));
    expect(createProject).toHaveBeenCalledTimes(1);
    expect(connectDiscord).toHaveBeenCalledWith("project-1", { guildId: "g1", channelId: "c1" });
    expect(syncDiscord).toHaveBeenCalledWith("project-1");
    // Discard clears storage. The persist effect must not write the empty draft back.
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull());
  });

  test("stays on review and warns when a Discord channel fails to attach", async () => {
    vi.mocked(createProject).mockResolvedValue(createdProject);
    vi.mocked(connectDiscord).mockRejectedValue(new Error("attach 500"));
    seedDraft(
      completeDraft({
        discordChannels: [
          { guildId: "g1", channelId: "c1", guildName: "Campus Cart", channelName: "dev" },
        ],
      }),
    );
    render(<ProjectReview />);

    fireEvent.click(await screen.findByRole("button", { name: "Create project" }));

    // Warning is shown and we do NOT navigate away automatically.
    expect(await screen.findByText(/couldn't be connected/)).toBeInTheDocument();
    expect(syncDiscord).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();

    // The project already exists, but the reviewed plan must stay on screen.
    // Discarding now would blank the page and surface empty-plan errors.
    expect(screen.getByText(/campus-only marketplace/)).toBeInTheDocument();
    expect(screen.getByText("Listings and search")).toBeInTheDocument();
    expect(screen.getByText("Core marketplace")).toBeInTheDocument();
    expect(screen.getByText("# dev")).toBeInTheDocument();
    expect(screen.queryByText("No project name yet.")).not.toBeInTheDocument();
    expect(screen.queryByText(/Fix these before creating the project/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    // Navigation happens only when the user continues, carrying the new id.
    // The draft is discarded then, once Review is no longer showing it.
    fireEvent.click(screen.getByRole("button", { name: "Continue to project" }));
    expect(pushMock).toHaveBeenCalledWith("/health?project=project-1");
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull());
  });

  test("stays on review when Discord messages fail to import", async () => {
    vi.mocked(createProject).mockResolvedValue(createdProject);
    vi.mocked(connectDiscord).mockResolvedValue({ provider: "discord", status: "connected" });
    vi.mocked(syncDiscord).mockRejectedValue(new Error("sync 502"));
    seedDraft(
      completeDraft({
        discordChannels: [
          { guildId: "g1", channelId: "c1", guildName: "Campus Cart", channelName: "dev" },
        ],
      }),
    );
    render(<ProjectReview />);

    fireEvent.click(await screen.findByRole("button", { name: "Create project" }));

    expect(await screen.findByText(/messages couldn't be imported/)).toBeInTheDocument();
    expect(syncDiscord).toHaveBeenCalledWith("project-1");
    expect(pushMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  test("opens the GitHub install page after Discord messages are imported", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    vi.mocked(createProject).mockResolvedValue(createdProject);
    vi.mocked(connectDiscord).mockResolvedValue({ provider: "discord", status: "connected" });
    vi.mocked(syncDiscord).mockResolvedValue({
      provider: "discord",
      status: "healthy",
      importedCount: 3,
    });
    vi.mocked(getGitHubInstallUrl).mockResolvedValue({
      url: "https://github.com/apps/devsync/installations/new",
    });
    seedDraft(
      completeDraft({
        connectGitHub: true,
        discordChannels: [
          { guildId: "g1", channelId: "c1", guildName: "Campus Cart", channelName: "dev" },
        ],
      }),
    );
    render(<ProjectReview />);

    expect(await screen.findByText(/GitHub: connects after the project is created/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("https://github.com/apps/devsync/installations/new"),
    );
    expect(syncDiscord).toHaveBeenCalledWith("project-1");
    expect(getGitHubInstallUrl).toHaveBeenCalledWith("project-1");
    expect(pushMock).not.toHaveBeenCalled();
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull());
  });

  test("stays on review when the GitHub install page can't be opened", async () => {
    vi.mocked(createProject).mockResolvedValue(createdProject);
    vi.mocked(getGitHubInstallUrl).mockRejectedValue(new Error("API 502"));
    seedDraft(completeDraft({ connectGitHub: true }));
    render(<ProjectReview />);

    fireEvent.click(await screen.findByRole("button", { name: "Create project" }));

    expect(await screen.findByText(/GitHub couldn't be opened/)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Continue to project" }));
    expect(pushMock).toHaveBeenCalledWith("/health?project=project-1");
  });

  test("opens GitHub from continue when Discord could not be connected", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    vi.mocked(createProject).mockResolvedValue(createdProject);
    vi.mocked(connectDiscord).mockRejectedValue(new Error("attach 500"));
    vi.mocked(getGitHubInstallUrl).mockResolvedValue({
      url: "https://github.com/apps/devsync/installations/new",
    });
    seedDraft(
      completeDraft({
        connectGitHub: true,
        discordChannels: [
          { guildId: "g1", channelId: "c1", guildName: "Campus Cart", channelName: "dev" },
        ],
      }),
    );
    render(<ProjectReview />);

    fireEvent.click(await screen.findByRole("button", { name: "Create project" }));

    expect(await screen.findByText(/couldn't be connected/)).toBeInTheDocument();
    expect(getGitHubInstallUrl).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Continue to project" }));
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("https://github.com/apps/devsync/installations/new"),
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  test("preserves the reviewed plan when project creation fails", async () => {
    vi.mocked(createProject).mockRejectedValue(new Error("API 500"));
    seedDraft(completeDraft());
    render(<ProjectReview />);

    fireEvent.click(await screen.findByRole("button", { name: "Create project" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't be created/);
    expect(pushMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });
});
