import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import MilestoneLoader from "@/components/MilestoneLoader/MilestoneLoader";
import {
  addDeliverable,
  getMilestone,
  listProjects,
  updateDeliverable,
  updateMilestone,
} from "@/lib/api";
import { mockDashboard } from "@/lib/mockDashboard";
import type { MilestoneDetail } from "@/lib/types";

vi.mock("@/lib/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/api")>()),
    listProjects: vi.fn(),
    getMilestone: vi.fn(),
    updateMilestone: vi.fn(),
    addDeliverable: vi.fn(),
    updateDeliverable: vi.fn(),
}));

const searchParamsMock = { get: vi.fn<(key: string) => string | null>(() => null) };
vi.mock("next/navigation", () => ({
    useSearchParams: () => searchParamsMock,
}));

const project = mockDashboard.project;
const milestone = project.milestones.find((m) => m.status !== "completed")!;

const detail: MilestoneDetail = {
    id: milestone.id,
    projectId: project.id,
    title: milestone.title,
    dueAt: "2999-10-18T00:00:00Z",
    status: "at_risk",
    position: 2,
    totalMilestones: 3,
    progress: { completed: 1, total: 4, percent: 25 },
    deliverables: [
        { id: "d1", milestoneId: milestone.id, title: "Reserve item", status: "completed" },
        { id: "d2", milestoneId: milestone.id, title: "Notify seller", status: "in_progress" },
        { id: "d3", milestoneId: milestone.id, title: "Expiry rules", status: "blocked" },
        { id: "d4", milestoneId: milestone.id, title: "Edge-case tests", status: "planned" },
    ],
    recentActivity: [
        {
            id: "a1",
            source: "github",
            kind: "pull_request",
            occurredAt: new Date().toISOString(),
            title: "#45 seller notifications",
        },
        {
            id: "a2",
            source: "discord",
            kind: "message",
            occurredAt: new Date().toISOString(),
            title: "Can we lock the expiry rule?",
        },
    ],
};

function renderReady(override: Partial<MilestoneDetail> = {}) {
    vi.mocked(listProjects).mockResolvedValue([project]);
    vi.mocked(getMilestone).mockResolvedValue({ ...detail, ...override });
    render(<MilestoneLoader />);
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    searchParamsMock.get.mockReturnValue(null);
});

describe("Milestone detail page", () => {
    test("shows a loading message, then the first unfinished milestone", async () => {
        renderReady();

        expect(screen.getByText(/Loading milestone/)).toBeInTheDocument();
        expect(await screen.findByRole("heading", { name: milestone.title })).toBeInTheDocument();
        expect(getMilestone).toHaveBeenCalledWith(project.id, milestone.id);
    });

    test("loads the milestone named in the URL", async () => {
        const other = project.milestones[0];
        searchParamsMock.get.mockImplementation((key) => (key === "milestone" ? other.id : null));
        renderReady({ id: other.id });

        await screen.findByRole("heading", { name: milestone.title });
        expect(getMilestone).toHaveBeenCalledWith(project.id, other.id);
    });

    test("displays milestone progress, deadline, status, and position", async () => {
        renderReady();

        expect(await screen.findByText("25% complete")).toBeInTheDocument();
        expect(screen.getByText("Needs attention")).toBeInTheDocument();
        expect(screen.getByText("Oct 18, 2999")).toBeInTheDocument();
        expect(screen.getByText(/Milestone 2 of 3/)).toBeInTheDocument();
        expect(screen.getByText(/1 of 4 deliverables done · 1 blocked/)).toBeInTheDocument();
    });

    test("shows each deliverable and its current state", async () => {
        renderReady();

        expect(await screen.findByText("Reserve item")).toBeInTheDocument();
        expect(screen.getByText("Complete")).toBeInTheDocument();
        expect(screen.getByText("In progress")).toBeInTheDocument();
        expect(screen.getByText("Blocked")).toBeInTheDocument();
        expect(screen.getByText("Planned")).toBeInTheDocument();
    });

    test("displays recent GitHub and Discord activity without claiming a milestone link", async () => {
        renderReady();

        expect(await screen.findByText("#45 seller notifications")).toBeInTheDocument();
        expect(screen.getByText("Can we lock the expiry rule?")).toBeInTheDocument();
        expect(screen.getByText(/Not yet linked to individual milestones/)).toBeInTheDocument();
    });

    test("shows empty states instead of placeholder content when nothing is stored", async () => {
        renderReady({ recentActivity: [], deliverables: [], progress: { completed: 0, total: 0, percent: 0 } });

        expect(await screen.findByText("No GitHub activity has been synced yet.")).toBeInTheDocument();
        expect(screen.getByText("No Discord messages have been synced yet.")).toBeInTheDocument();
        expect(screen.getByText("Owners are not tracked yet.")).toBeInTheDocument();
        expect(screen.getByText("No deliverables yet. Add one to start tracking progress.")).toBeInTheDocument();
        expect(screen.getByText("No synced activity yet")).toBeInTheDocument();
    });

    test("completing a deliverable refreshes displayed progress", async () => {
        vi.mocked(updateDeliverable).mockResolvedValue({ ...detail.deliverables[1], status: "completed" });
        renderReady();

        fireEvent.click(await screen.findByRole("button", { name: 'Mark "Notify seller" complete' }));

        expect(await screen.findByText("50% complete")).toBeInTheDocument();
        expect(updateDeliverable).toHaveBeenCalledWith(project.id, "d2", { status: "completed" });
    });

    test("reopening a completed deliverable lowers progress", async () => {
        vi.mocked(updateDeliverable).mockResolvedValue({ ...detail.deliverables[0], status: "in_progress" });
        renderReady();

        fireEvent.click(await screen.findByRole("button", { name: 'Mark "Reserve item" incomplete' }));

        expect(await screen.findByText("0% complete")).toBeInTheDocument();
        expect(updateDeliverable).toHaveBeenCalledWith(project.id, "d1", { status: "in_progress" });
    });

    test("rolls back a deliverable change that fails to save", async () => {
        vi.mocked(updateDeliverable).mockRejectedValue(new Error("API 500"));
        renderReady();

        fireEvent.click(await screen.findByRole("button", { name: 'Mark "Notify seller" complete' }));

        expect(await screen.findByRole("alert")).toHaveTextContent(/could not be saved/);
        expect(screen.getByText("25% complete")).toBeInTheDocument();
    });

    test("opens milestone editing and saves valid changes", async () => {
        vi.mocked(updateMilestone).mockResolvedValue({ ...detail, title: "Beta checkout v2", status: "in_progress" });
        renderReady();

        fireEvent.click(await screen.findByRole("button", { name: "Edit milestone" }));
        fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Beta checkout v2" } });
        fireEvent.change(screen.getByLabelText("Target date"), { target: { value: "2999-11-01" } });
        fireEvent.change(screen.getByLabelText("Status"), { target: { value: "in_progress" } });
        fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

        expect(await screen.findByRole("heading", { name: "Beta checkout v2" })).toBeInTheDocument();
        expect(updateMilestone).toHaveBeenCalledWith(project.id, milestone.id, {
            title: "Beta checkout v2",
            dueAt: "2999-11-01T00:00:00Z",
            status: "in_progress",
        });
    });

    test("does not save a milestone with an empty name", async () => {
        renderReady();

        fireEvent.click(await screen.findByRole("button", { name: "Edit milestone" }));
        fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  " } });
        fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

        expect(await screen.findByText("Enter a milestone name.")).toBeInTheDocument();
        expect(updateMilestone).not.toHaveBeenCalled();
    });

    test("adds a deliverable to the milestone", async () => {
        vi.mocked(addDeliverable).mockResolvedValue({
            id: "d5",
            milestoneId: milestone.id,
            title: "Refund flow",
            status: "planned",
        });
        renderReady();

        fireEvent.click(await screen.findByRole("button", { name: "+ Add deliverable" }));
        fireEvent.change(screen.getByLabelText("Deliverable name"), { target: { value: "Refund flow" } });
        fireEvent.click(screen.getByRole("button", { name: "Add" }));

        expect(await screen.findByText("Refund flow")).toBeInTheDocument();
        expect(screen.getByText(/1 of 5 deliverables done/)).toBeInTheDocument();
        expect(addDeliverable).toHaveBeenCalledWith(project.id, milestone.id, "Refund flow");
    });

    test("keeps the form open with a message when adding a deliverable fails", async () => {
        vi.mocked(addDeliverable).mockRejectedValue(new Error("API 500"));
        renderReady();

        fireEvent.click(await screen.findByRole("button", { name: "+ Add deliverable" }));
        fireEvent.change(screen.getByLabelText("Deliverable name"), { target: { value: "Refund flow" } });
        fireEvent.click(screen.getByRole("button", { name: "Add" }));

        await waitFor(() => expect(screen.getByText(/could not be added/)).toBeInTheDocument());
    });

    test("tells a user with no projects to create one", async () => {
        vi.mocked(listProjects).mockResolvedValue([]);
        render(<MilestoneLoader />);

        expect(await screen.findByText(/don.t have any projects yet/)).toBeInTheDocument();
    });

    test("explains when the API request fails", async () => {
        vi.mocked(listProjects).mockRejectedValue(new Error("API 500"));
        render(<MilestoneLoader />);

        expect(await screen.findByText(/couldn.t be loaded/)).toBeInTheDocument();
    });

    test.todo("shows active blockers and related Discord context beyond raw activity");
    test.todo("displays recommended actions for the milestone");
    test.todo("creates action items from selected recommendations");
});
