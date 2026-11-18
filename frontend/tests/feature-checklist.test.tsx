import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import FeatureChecklist from "@/components/FeatureChecklist/FeatureChecklist";
import { setFeatureCompleted } from "@/lib/api";
import { mockDashboard } from "@/lib/mockDashboard";

// Replace the save call with a fake; keep everything else in api.ts real.
vi.mock("@/lib/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/api")>()),
    setFeatureCompleted: vi.fn(),
}));

afterEach(() => {
    cleanup();
    vi.mocked(setFeatureCompleted).mockReset();
});

const features = ["Accounts", "Listings", "Checkout"];

function renderChecklist() {
    render(<FeatureChecklist projectId="p1" features={features} completedFeatures={["Accounts"]} />);
}

describe("FeatureChecklist", () => {
    test("shows which features are done", () => {
        renderChecklist();
        expect(screen.getByText("1 of 3 done")).toBeInTheDocument();
        expect(screen.getByRole("checkbox", { name: "Accounts" })).toBeChecked();
        expect(screen.getByRole("checkbox", { name: "Listings" })).not.toBeChecked();
    });

    test("marks a feature as done", async () => {
        vi.mocked(setFeatureCompleted).mockResolvedValue({
            ...mockDashboard.project,
            completedFeatures: ["Accounts", "Listings"],
        });
        renderChecklist();

        fireEvent.click(screen.getByRole("checkbox", { name: "Listings" }));

        expect(setFeatureCompleted).toHaveBeenCalledWith("p1", "Listings", true);
        expect(await screen.findByText("2 of 3 done")).toBeInTheDocument();
    });

    test("undoes the change and shows an error when saving fails", async () => {
        vi.mocked(setFeatureCompleted).mockRejectedValue(new Error("API 500"));
        renderChecklist();

        fireEvent.click(screen.getByRole("checkbox", { name: "Listings" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't save/i);
        expect(screen.getByRole("checkbox", { name: "Listings" })).not.toBeChecked();
        expect(screen.getByText("1 of 3 done")).toBeInTheDocument();
    });

    test("shows an empty state when the plan has no features", () => {
        render(<FeatureChecklist projectId="p1" features={[]} completedFeatures={[]} />);
        expect(screen.getByText("No features in the project plan yet.")).toBeInTheDocument();
    });
});