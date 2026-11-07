import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import HealthDashboardLoader from "@/components/HealthDashboardLoader/HealthDashboardLoader";
import ProjectsLoader from "@/components/ProjectsLoader/ProjectsLoader";
import { getDashboard, listProjects } from "@/lib/api";
import { mockDashboard } from "@/lib/mockDashboard";
import type { Dashboard } from "@/lib/types";

// Replace the two API calls with fakes; keep everything else in api.ts real
vi.mock("@/lib/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/api")>()),
    listProjects: vi.fn(),
    getDashboard: vi.fn(),
}));

const otherDashboard: Dashboard = {
    ...mockDashboard,
    project: { ...mockDashboard.project, id: "other-project", name: "Study Buddy" },
};

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
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