import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import MilestonesLoader from "@/components/MilestonesLoader/MilestonesLoader";
import PageHeader from "@/components/PageHeader/PageHeader";
import { listProjects } from "@/lib/api";
import { mockDashboard } from "@/lib/mockDashboard";

vi.mock("@/lib/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/api")>()),
    listProjects: vi.fn(),
}));

const searchParamsMock = { get: vi.fn<(key: string) => string | null>(() => null) };
vi.mock("next/navigation", () => ({
    useSearchParams: () => searchParamsMock,
}));

const project = mockDashboard.project;
const other = { ...project, id: "other-project", name: "Study Buddy" };

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    searchParamsMock.get.mockReturnValue(null);
});

describe("Milestones list page", () => {
    test("shows a loading message, then every milestone in the project", async () => {
        vi.mocked(listProjects).mockResolvedValue([project]);
        render(<MilestonesLoader />);

        expect(screen.getByText(/Loading milestones/)).toBeInTheDocument();
        const items = await screen.findAllByRole("listitem");
        expect(items).toHaveLength(project.milestones.length);
        for (const milestone of project.milestones) {
            expect(screen.getByText(milestone.title)).toBeInTheDocument();
        }
    });

    test("lists milestones in due-date order", async () => {
        vi.mocked(listProjects).mockResolvedValue([
            { ...project, milestones: [...project.milestones].reverse() },
        ]);
        render(<MilestonesLoader />);

        const titles = (await screen.findAllByRole("listitem")).map(
            (item) => within(item).getAllByText(/./)[1].textContent,
        );
        const expected = [...project.milestones]
            .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
            .map((m) => m.title);
        expect(titles).toEqual(expected);
    });

    test("each milestone links to its detail page and keeps the project", async () => {
        vi.mocked(listProjects).mockResolvedValue([project]);
        render(<MilestonesLoader />);

        const target = project.milestones[0];
        const link = (await screen.findByText(target.title)).closest("a");
        expect(link).toHaveAttribute("href", `/milestones/${target.id}?project=${project.id}`);
    });

    test("shows status and deliverable progress for each milestone", async () => {
        vi.mocked(listProjects).mockResolvedValue([project]);
        render(<MilestonesLoader />);

        const beta = project.milestones.find((m) => m.title === "Beta checkout")!;
        const total = project.deliverables.filter((d) => d.milestoneId === beta.id);
        const done = total.filter((d) => d.status === "completed").length;
        const row = (await screen.findByText("Beta checkout")).closest("li")!;
        expect(within(row).getByText(`${done} of ${total.length} deliverables done`)).toBeInTheDocument();
        expect(within(row).getByText(/In progress|Planned|Needs attention|Completed/)).toBeInTheDocument();
    });

    test("loads the project named in ?project= instead of the first", async () => {
        searchParamsMock.get.mockReturnValue("other-project");
        vi.mocked(listProjects).mockResolvedValue([project, { ...other, milestones: [project.milestones[0]] }]);
        render(<MilestonesLoader />);

        expect(await screen.findAllByRole("listitem")).toHaveLength(1);
        expect(screen.getAllByText("Study Buddy").length).toBeGreaterThan(0);
    });

    test("says so when the project has no milestones", async () => {
        vi.mocked(listProjects).mockResolvedValue([{ ...project, milestones: [], deliverables: [] }]);
        render(<MilestonesLoader />);

        expect(await screen.findByText(/doesn.t have any milestones yet/)).toBeInTheDocument();
    });

    test("tells a user with no projects to create one", async () => {
        vi.mocked(listProjects).mockResolvedValue([]);
        render(<MilestonesLoader />);

        expect(await screen.findByText(/don.t have any projects yet/)).toBeInTheDocument();
    });

    test("explains when the API request fails", async () => {
        vi.mocked(listProjects).mockRejectedValue(new Error("API 500"));
        render(<MilestonesLoader />);

        expect(await screen.findByText(/couldn.t be loaded/)).toBeInTheDocument();
    });
});

describe("Page header back arrow", () => {
    test("is a labelled link when given a destination", () => {
        render(<PageHeader title="T" description="D" backHref="/milestones" backLabel="Back to milestones" />);

        expect(screen.getByRole("link", { name: "Back to milestones" })).toHaveAttribute("href", "/milestones");
    });

    test("is not a link without a destination", () => {
        render(<PageHeader title="T" description="D" />);

        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
});
