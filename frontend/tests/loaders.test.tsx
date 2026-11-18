import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import HealthDashboardLoader from "@/components/HealthDashboardLoader/HealthDashboardLoader";
import ProjectsLoader from "@/components/ProjectsLoader/ProjectsLoader";
import {
    connectDiscord,
    generateProjectSummary,
    getDashboard,
    listDiscordChannels,
    listProjects,
    syncDiscord,
} from "@/lib/api";
import { getGitHubInstallUrl, syncGitHub } from "@/lib/github";
import { mockDashboard } from "@/lib/mockDashboard";
import type { Dashboard } from "@/lib/types";

// Replace API calls with fakes; keep everything else in api.ts real
vi.mock("@/lib/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/api")>()),
    listProjects: vi.fn(),
    getDashboard: vi.fn(),
    generateProjectSummary: vi.fn(),
    listDiscordChannels: vi.fn(),
    connectDiscord: vi.fn(),
    syncDiscord: vi.fn(),
}));

vi.mock("@/lib/github", () => ({
    getGitHubInstallUrl: vi.fn(),
    syncGitHub: vi.fn(),
}));

// The health loader reads `?project=` to pick which project to show.
const searchParamsMock = { get: vi.fn<(key: string) => string | null>(() => null) };
vi.mock("next/navigation", () => ({
    useSearchParams: () => searchParamsMock,
}));

const otherDashboard: Dashboard = {
    ...mockDashboard,
    project: { ...mockDashboard.project, id: "other-project", name: "Study Buddy" },
};

const discordGuilds = [
    {
        id: "guild-1",
        name: "Campus Cart",
        channels: [{ id: "channel-1", name: "dev" }],
    },
];

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    searchParamsMock.get.mockReturnValue(null);
});

describe("Project health loader", () => {
    test("shows a loading message, then the first project's health", async () => {
        vi.mocked(listProjects).mockResolvedValue([mockDashboard.project]);
        vi.mocked(getDashboard).mockResolvedValue(mockDashboard);

        render(<HealthDashboardLoader />);

        expect(screen.getByText(/Loading project health/)).toBeInTheDocument();
        expect(await screen.findByText("65 / 100")).toBeInTheDocument();
        expect(getDashboard).toHaveBeenCalledWith(mockDashboard.project.id);
    });

    test("loads the project named in ?project= instead of the first", async () => {
        searchParamsMock.get.mockReturnValue("other-project");
        vi.mocked(listProjects).mockResolvedValue([mockDashboard.project, otherDashboard.project]);
        vi.mocked(getDashboard).mockResolvedValue(otherDashboard);

        render(<HealthDashboardLoader />);

        expect(await screen.findByText("65 / 100")).toBeInTheDocument();
        expect(getDashboard).toHaveBeenCalledWith("other-project");
        expect(screen.getByRole("link", { name: "Milestones" })).toHaveAttribute(
            "href",
            "/milestones?project=other-project",
        );
    });

    test("offers every project in the sidebar switcher", async () => {
        vi.mocked(listProjects).mockResolvedValue([mockDashboard.project, otherDashboard.project]);
        vi.mocked(getDashboard).mockResolvedValue(mockDashboard);

        render(<HealthDashboardLoader />);

        fireEvent.click(await screen.findByRole("button", { name: "Campus Cart" }));

        expect(screen.getByRole("link", { name: "Campus Cart" })).toHaveAttribute("aria-current", "true");
        expect(screen.getByRole("link", { name: "Study Buddy" })).toHaveAttribute(
            "href",
            "/health?project=other-project",
        );
    });

    test("shows the loading state again when switching projects", async () => {
        vi.mocked(listProjects).mockResolvedValue([mockDashboard.project, otherDashboard.project]);
        vi.mocked(getDashboard).mockImplementation((projectId) =>
            projectId === "other-project" ? new Promise<Dashboard>(() => {}) : Promise.resolve(mockDashboard),
        );

        const { rerender } = render(<HealthDashboardLoader />);
        expect(await screen.findByText("65 / 100")).toBeInTheDocument();

        searchParamsMock.get.mockReturnValue("other-project");
        rerender(<HealthDashboardLoader />);

        expect(screen.getByText(/Loading project health/)).toBeInTheDocument();
        expect(screen.queryByText("65 / 100")).not.toBeInTheDocument();
    });

    test("falls back to the first project when ?project= is unknown", async () => {
        searchParamsMock.get.mockReturnValue("does-not-exist");
        vi.mocked(listProjects).mockResolvedValue([mockDashboard.project]);
        vi.mocked(getDashboard).mockResolvedValue(mockDashboard);

        render(<HealthDashboardLoader />);

        expect(await screen.findByText("65 / 100")).toBeInTheDocument();
        expect(getDashboard).toHaveBeenCalledWith(mockDashboard.project.id);
    });

    test("offers to create a project when the user has none", async () => {
        vi.mocked(listProjects).mockResolvedValue([]);

        render(<HealthDashboardLoader />);

        expect(await screen.findByText(/don't have any projects yet/)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Create a project" })).toHaveAttribute("href", "/projects/new");
        expect(getDashboard).not.toHaveBeenCalled();
    });

    test("shows an error when the dashboard can't be loaded", async () => {
        vi.mocked(listProjects).mockRejectedValue(new Error("API 500"));

        render(<HealthDashboardLoader />);

        expect(await screen.findByText(/couldn't be loaded/)).toBeInTheDocument();
    });

    test("generates and displays a new project summary", async () => {
        const dashboardWithoutSummary = { ...mockDashboard, latestSummary: null };
        const generatedSummary = {
            ...mockDashboard.latestSummary!,
            text: "The newly generated project summary.",
        };
        const refreshedDashboard = {
            ...dashboardWithoutSummary,
            latestSummary: generatedSummary,
            analysisStatus: "current" as const,
        };
        vi.mocked(listProjects).mockResolvedValue([mockDashboard.project]);
        vi.mocked(getDashboard)
            .mockResolvedValueOnce(dashboardWithoutSummary)
            .mockResolvedValueOnce(refreshedDashboard);
        vi.mocked(generateProjectSummary).mockResolvedValue(generatedSummary);

        render(<HealthDashboardLoader />);

        fireEvent.click(await screen.findByRole("button", { name: "Generate summary" }));

        expect(generateProjectSummary).toHaveBeenCalledWith(mockDashboard.project.id);
        expect(await screen.findByText(generatedSummary.text)).toBeInTheDocument();
        expect(getDashboard).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("button", { name: "Refresh summary" })).toBeInTheDocument();
    });

    test("keeps the previous summary visible when generation fails", async () => {
        vi.mocked(listProjects).mockResolvedValue([mockDashboard.project]);
        vi.mocked(getDashboard).mockResolvedValue(mockDashboard);
        vi.mocked(generateProjectSummary).mockRejectedValue(new Error("API 502"));

        render(<HealthDashboardLoader />);

        fireEvent.click(await screen.findByRole("button", { name: "Refresh summary" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "The summary could not be generated. Please try again.",
        );
        expect(screen.getByText(/checkout is now the critical path/)).toBeInTheDocument();
    });
});

describe("Project health sync actions", () => {
    test("syncs GitHub and Discord, then shows the refreshed dashboard", async () => {
        const refreshed = {
            ...mockDashboard,
            latestSummary: { ...mockDashboard.latestSummary!, text: "Updated after the sync." },
        };
        vi.mocked(listProjects).mockResolvedValue([mockDashboard.project]);
        vi.mocked(getDashboard).mockResolvedValueOnce(mockDashboard).mockResolvedValueOnce(refreshed);
        vi.mocked(syncGitHub).mockResolvedValue({ provider: "github", status: "healthy", importedCount: 4 });
        vi.mocked(syncDiscord).mockResolvedValue({ provider: "discord", status: "healthy", importedCount: 2 });

        render(<HealthDashboardLoader />);
        fireEvent.click(await screen.findByRole("button", { name: "Sync now" }));

        expect(await screen.findByText("Updated after the sync.")).toBeInTheDocument();
        expect(syncGitHub).toHaveBeenCalledWith(mockDashboard.project.id);
        expect(syncDiscord).toHaveBeenCalledWith(mockDashboard.project.id);
    });

    test("syncs GitHub only when Discord is not connected", async () => {
        const withoutDiscord = {
            ...mockDashboard,
            integrations: mockDashboard.integrations.filter((item) => item.provider !== "discord"),
        };
        vi.mocked(listProjects).mockResolvedValue([mockDashboard.project]);
        vi.mocked(getDashboard).mockResolvedValue(withoutDiscord);
        vi.mocked(syncGitHub).mockResolvedValue({ provider: "github", status: "healthy", importedCount: 1 });

        render(<HealthDashboardLoader />);
        fireEvent.click(await screen.findByRole("button", { name: "Sync now" }));

        await vi.waitFor(() => expect(syncGitHub).toHaveBeenCalledWith(mockDashboard.project.id));
        expect(syncDiscord).not.toHaveBeenCalled();
    });

    test("syncs Discord when GitHub is not connected", async () => {
        const withoutGitHub = {
            ...mockDashboard,
            integrations: mockDashboard.integrations.filter((item) => item.provider !== "github"),
        };
        vi.mocked(listProjects).mockResolvedValue([mockDashboard.project]);
        vi.mocked(getDashboard).mockResolvedValue(withoutGitHub);
        vi.mocked(syncDiscord).mockResolvedValue({
            provider: "discord",
            status: "healthy",
            importedCount: 2,
        });

        render(<HealthDashboardLoader />);
        fireEvent.click(await screen.findByRole("button", { name: "Sync now" }));

        await vi.waitFor(() => expect(syncDiscord).toHaveBeenCalledWith(mockDashboard.project.id));
        expect(syncGitHub).not.toHaveBeenCalled();
    });

    test("reloads the dashboard and shows an error when the sync fails", async () => {
        vi.mocked(listProjects).mockResolvedValue([mockDashboard.project]);
        vi.mocked(getDashboard).mockResolvedValue(mockDashboard);
        vi.mocked(syncGitHub).mockRejectedValue(new Error("API 502"));
        vi.mocked(syncDiscord).mockResolvedValue({ provider: "discord", status: "healthy", importedCount: 0 });

        render(<HealthDashboardLoader />);
        fireEvent.click(await screen.findByRole("button", { name: "Sync now" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("GitHub sync failed");
        expect(syncDiscord).toHaveBeenCalledWith(mockDashboard.project.id);
        expect(getDashboard).toHaveBeenCalledTimes(2);
    });

    test("reloads the dashboard when Discord sync fails", async () => {
        const refreshed = {
            ...mockDashboard,
            latestSummary: { ...mockDashboard.latestSummary!, text: "Updated after the sync." },
        };
        vi.mocked(listProjects).mockResolvedValue([mockDashboard.project]);
        vi.mocked(getDashboard).mockResolvedValueOnce(mockDashboard).mockResolvedValueOnce(refreshed);
        vi.mocked(syncGitHub).mockResolvedValue({ provider: "github", status: "healthy", importedCount: 4 });
        vi.mocked(syncDiscord).mockRejectedValue(new Error("API 502"));

        render(<HealthDashboardLoader />);
        fireEvent.click(await screen.findByRole("button", { name: "Sync now" }));

        expect(await screen.findByText("Updated after the sync.")).toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent("Discord sync failed");
        expect(getDashboard).toHaveBeenCalledTimes(2);
    });

    test("still offers GitHub connection when only Discord is connected", async () => {
        const withoutGitHub = {
            ...mockDashboard,
            integrations: mockDashboard.integrations.filter((item) => item.provider !== "github"),
        };
        const assign = vi.fn();
        vi.stubGlobal("location", { ...window.location, assign });
        vi.mocked(listProjects).mockResolvedValue([mockDashboard.project]);
        vi.mocked(getDashboard).mockResolvedValue(withoutGitHub);
        vi.mocked(getGitHubInstallUrl).mockResolvedValue({ url: "https://github.com/apps/devsync/installations/new" });

        render(<HealthDashboardLoader />);
        expect(await screen.findByRole("button", { name: "Sync now" })).toBeInTheDocument();
        fireEvent.click(await screen.findByRole("button", { name: "Connect GitHub" }));

        await vi.waitFor(() =>
            expect(assign).toHaveBeenCalledWith("https://github.com/apps/devsync/installations/new"),
        );
    });

    test("connects and initially syncs Discord from the project health overlay", async () => {
        const withoutDiscord = {
            ...mockDashboard,
            integrations: mockDashboard.integrations.filter((item) => item.provider !== "discord"),
        };
        vi.mocked(listProjects).mockResolvedValue([mockDashboard.project]);
        vi.mocked(getDashboard).mockResolvedValueOnce(withoutDiscord).mockResolvedValueOnce(mockDashboard);
        vi.mocked(listDiscordChannels).mockResolvedValue(discordGuilds);
        vi.mocked(connectDiscord).mockResolvedValue({ provider: "discord", status: "connected" });
        vi.mocked(syncDiscord).mockResolvedValue({
            provider: "discord",
            status: "healthy",
            importedCount: 3,
        });

        render(<HealthDashboardLoader />);
        fireEvent.click(await screen.findByRole("button", { name: "Connect Discord" }));

        const dialog = await screen.findByRole("dialog", { name: "Connect Discord" });
        fireEvent.click(await within(dialog).findByRole("button", { name: /# dev/ }));
        fireEvent.click(within(dialog).getByRole("button", { name: "Connect Discord" }));

        await vi.waitFor(() =>
            expect(connectDiscord).toHaveBeenCalledWith(mockDashboard.project.id, {
                guildId: "guild-1",
                channelId: "channel-1",
            }),
        );
        expect(syncDiscord).toHaveBeenCalledWith(mockDashboard.project.id);
        await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(screen.queryByRole("button", { name: "Connect Discord" })).not.toBeInTheDocument();
    });

    test("closes the Discord connection overlay with Escape", async () => {
        const withoutDiscord = {
            ...mockDashboard,
            integrations: mockDashboard.integrations.filter((item) => item.provider !== "discord"),
        };
        vi.mocked(listProjects).mockResolvedValue([mockDashboard.project]);
        vi.mocked(getDashboard).mockResolvedValue(withoutDiscord);
        vi.mocked(listDiscordChannels).mockResolvedValue(discordGuilds);

        render(<HealthDashboardLoader />);
        fireEvent.click(await screen.findByRole("button", { name: "Connect Discord" }));
        expect(await screen.findByRole("dialog", { name: "Connect Discord" })).toBeInTheDocument();

        fireEvent.keyDown(window, { key: "Escape" });

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    test("shows the health-page error when Discord channels cannot be loaded", async () => {
        const withoutDiscord = {
            ...mockDashboard,
            integrations: mockDashboard.integrations.filter((item) => item.provider !== "discord"),
        };
        vi.mocked(listProjects).mockResolvedValue([mockDashboard.project]);
        vi.mocked(getDashboard).mockResolvedValue(withoutDiscord);
        vi.mocked(listDiscordChannels).mockRejectedValue(new Error("API 502"));

        render(<HealthDashboardLoader />);
        fireEvent.click(await screen.findByRole("button", { name: "Connect Discord" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Discord couldn't be connected. Please try again.",
        );
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    test("shows the health-page error when Discord cannot be connected", async () => {
        const withoutDiscord = {
            ...mockDashboard,
            integrations: mockDashboard.integrations.filter((item) => item.provider !== "discord"),
        };
        vi.mocked(listProjects).mockResolvedValue([mockDashboard.project]);
        vi.mocked(getDashboard).mockResolvedValue(withoutDiscord);
        vi.mocked(listDiscordChannels).mockResolvedValue(discordGuilds);
        vi.mocked(connectDiscord).mockRejectedValue(new Error("API 502"));

        render(<HealthDashboardLoader />);
        fireEvent.click(await screen.findByRole("button", { name: "Connect Discord" }));

        const dialog = await screen.findByRole("dialog", { name: "Connect Discord" });
        fireEvent.click(await within(dialog).findByRole("button", { name: /# dev/ }));
        fireEvent.click(within(dialog).getByRole("button", { name: "Connect Discord" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Discord couldn't be connected. Please try again.",
        );
        expect(syncDiscord).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
});

describe("Projects loader", () => {
    test("shows a card for every project the user belongs to", async () => {
        vi.mocked(listProjects).mockResolvedValue([mockDashboard.project, otherDashboard.project]);
        vi.mocked(getDashboard).mockImplementation(async (projectId) =>
            projectId === otherDashboard.project.id ? otherDashboard : mockDashboard,
        );

        render(<ProjectsLoader />);

        expect(screen.getByText(/Loading projects/)).toBeInTheDocument();
        expect(await screen.findByRole("link", { name: /Campus Cart/ })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Study Buddy/ })).toBeInTheDocument();
        expect(getDashboard).toHaveBeenCalledTimes(2);
    });

    test("shows the empty state when the user has no projects", async () => {
        vi.mocked(listProjects).mockResolvedValue([]);

        render(<ProjectsLoader />);

        expect(await screen.findByText("No projects yet. Create one to get started.")).toBeInTheDocument();
    });

    test("shows an error when projects can't be loaded", async () => {
        vi.mocked(listProjects).mockRejectedValue(new Error("API 500"));

        render(<ProjectsLoader />);

        expect(await screen.findByText(/couldn't be loaded/)).toBeInTheDocument();
    });
});
