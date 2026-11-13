import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import CreateProject from "@/components/CreateProject/CreateProject";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function fillRequiredPlan() {
  fireEvent.change(screen.getByLabelText("Project name"), {
    target: { value: "Campus Cart" },
  });
  fireEvent.change(screen.getByLabelText("What are you building?"), {
    target: { value: "A campus-only marketplace for students to buy and sell used textbooks." },
  });
  fireEvent.change(screen.getByLabelText("Feature"), {
    target: { value: "Listings and search" },
  });
  fireEvent.change(screen.getByLabelText("Milestone 1"), {
    target: { value: "Core marketplace" },
  });
  fireEvent.change(screen.getByLabelText("Target date"), {
    target: { value: "2030-10-10" },
  });
}

describe("Project initialization and onboarding", () => {
  test("does not collect fields the backend does not store", () => {
    render(<CreateProject />);
    for (const label of ["Target deadline", "Project owner", "Team", "Owner", "Detail"]) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    }
  });

  test("shows the project setup steps in the expected order", () => {
    render(<CreateProject />);
    const stepLabels = ["Project basics", "Plan details", "Integrations", "Review"];
    stepLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  test("prevents continuing when required project fields are missing", () => {
    render(<CreateProject />);
    const continueButton = screen.getByRole("button", { name: /continue to integrations/i });
    expect(continueButton).toBeDisabled();
    expect(screen.getByText(/required item/i)).toBeInTheDocument();
  });

  test("adds, edits, and removes features and milestones", async () => {
    const user = userEvent.setup();
    render(<CreateProject />);

    // One feature row exists by default.
    expect(screen.getAllByLabelText("Feature")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "+ Add feature" }));
    expect(screen.getAllByLabelText("Feature")).toHaveLength(2);

    const firstFeature = screen.getAllByLabelText("Feature")[0];
    fireEvent.change(firstFeature, { target: { value: "Accounts" } });
    expect((firstFeature as HTMLInputElement).value).toBe("Accounts");

    const removeButtons = screen.getAllByRole("button", { name: /remove feature/i });
    await user.click(removeButtons[0]);
    expect(screen.getAllByLabelText("Feature")).toHaveLength(1);

    // Milestones.
    await user.click(screen.getByRole("button", { name: "+ Add milestone" }));
    expect(screen.getAllByLabelText(/^Milestone \d+$/)).toHaveLength(2);
    const removeMilestone = screen.getAllByRole("button", { name: /remove milestone/i });
    await user.click(removeMilestone[0]);
    expect(screen.getAllByLabelText(/^Milestone \d+$/)).toHaveLength(1);
  });

  test("nests deliverables under a milestone and has no orphan link dropdown", async () => {
    const user = userEvent.setup();
    render(<CreateProject />);
    fireEvent.change(screen.getByLabelText("Milestone 1"), { target: { value: "Core" } });
    await user.click(screen.getByRole("button", { name: "+ Add deliverable" }));
    expect(screen.getByLabelText("Deliverable")).toBeInTheDocument();
    expect(screen.queryByLabelText(/linked milestone/i)).not.toBeInTheDocument();
    expect(screen.getByText("1 deliverable")).toBeInTheDocument();
  });

  test("moves a deliverable to another milestone via Move to", async () => {
    const user = userEvent.setup();
    render(<CreateProject />);
    await user.click(screen.getByRole("button", { name: "+ Add milestone" }));
    fireEvent.change(screen.getByLabelText("Milestone 1"), { target: { value: "Alpha" } });
    fireEvent.change(screen.getByLabelText("Milestone 2"), { target: { value: "Beta" } });
    await user.click(screen.getAllByRole("button", { name: "+ Add deliverable" })[0]);
    fireEvent.change(screen.getByLabelText("Deliverable"), { target: { value: "Auth" } });

    const regions = screen.getAllByTestId("deliverables-region");
    expect(within(regions[0]).getByLabelText("Deliverable")).toBeInTheDocument();
    expect(within(regions[1]).queryByLabelText("Deliverable")).not.toBeInTheDocument();

    const select = screen.getByLabelText("Move to milestone");
    expect(within(select).queryByRole("option", { name: "Alpha" })).not.toBeInTheDocument();
    await user.selectOptions(select, "Beta");

    const after = screen.getAllByTestId("deliverables-region");
    expect(within(after[0]).queryByLabelText("Deliverable")).not.toBeInTheDocument();
    expect((within(after[1]).getByLabelText("Deliverable") as HTMLInputElement).value).toBe("Auth");
  });

  test("hides Move to when there is only one milestone", async () => {
    const user = userEvent.setup();
    render(<CreateProject />);
    await user.click(screen.getByRole("button", { name: "+ Add deliverable" }));
    expect(screen.queryByLabelText("Move to milestone")).not.toBeInTheDocument();
  });

  test("removing a milestone removes its nested deliverables", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<CreateProject />);
    await user.click(screen.getByRole("button", { name: "+ Add deliverable" }));
    expect(screen.getByLabelText("Deliverable")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /remove milestone/i }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Deliverable")).not.toBeInTheDocument();
  });

  test("deletes an empty milestone immediately", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<CreateProject />);
    await user.click(screen.getByRole("button", { name: "+ Add milestone" }));
    expect(screen.getAllByLabelText(/^Milestone \d+$/)).toHaveLength(2);
    await user.click(screen.getAllByRole("button", { name: /remove milestone/i })[1]);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getAllByLabelText(/^Milestone \d+$/)).toHaveLength(1);
  });

  test("confirms before deleting a milestone that has deliverables", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<CreateProject />);
    await user.click(screen.getByRole("button", { name: "+ Add deliverable" }));
    await user.click(screen.getByRole("button", { name: /remove milestone/i }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/1 deliverable\b/));
    expect(screen.getByLabelText("Milestone 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Deliverable")).toBeInTheDocument();

    confirmSpy.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: /remove milestone/i }));
    expect(screen.queryByLabelText("Milestone 1")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Deliverable")).not.toBeInTheDocument();
  });

  test("focuses the new title field after adding feature, milestone, deliverable", async () => {
    const user = userEvent.setup();
    render(<CreateProject />);
    await user.click(screen.getByRole("button", { name: "+ Add feature" }));
    expect(screen.getAllByLabelText("Feature")[1]).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "+ Add milestone" }));
    expect(screen.getByLabelText("Milestone 2")).toHaveFocus();
    await user.click(screen.getAllByRole("button", { name: "+ Add deliverable" })[0]);
    expect(screen.getByLabelText("Deliverable")).toHaveFocus();
  });

  test("adds, edits, and removes deliverables", async () => {
    const user = userEvent.setup();
    render(<CreateProject />);

    expect(screen.queryByLabelText("Deliverable")).not.toBeInTheDocument();
    expect(
      screen.getByText("Each milestone must have at least one deliverable."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+ Add deliverable" }));
    const deliverable = screen.getByLabelText("Deliverable");
    fireEvent.change(deliverable, { target: { value: "Auth service" } });
    expect((deliverable as HTMLInputElement).value).toBe("Auth service");

    await user.click(screen.getByRole("button", { name: /remove deliverable/i }));
    expect(screen.queryByLabelText("Deliverable")).not.toBeInTheDocument();
  });

  test("preserves entered data when navigating between steps", () => {
    const { unmount } = render(<CreateProject />);
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Preserved Project" },
    });
    unmount();

    render(<CreateProject />);
    expect((screen.getByLabelText("Project name") as HTMLInputElement).value).toBe(
      "Preserved Project",
    );
  });

  test("saves and resumes an incomplete project draft", () => {
    const { unmount } = render(<CreateProject />);
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Half-finished" },
    });
    expect(screen.queryByText(/resumed from your previously saved draft/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /save draft/i })[0]);
    unmount();

    render(<CreateProject />);
    expect((screen.getByLabelText("Project name") as HTMLInputElement).value).toBe("Half-finished");
    expect(screen.getByRole("button", { name: /discard draft/i })).toBeInTheDocument();
    expect(screen.getByText(/resumed from your previously saved draft/i)).toBeInTheDocument();
  });

  test("does not label a fresh edit as a resumed draft", () => {
    render(<CreateProject />);
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Brand new" },
    });
    expect(screen.queryByText(/resumed from your previously saved draft/i)).not.toBeInTheDocument();
  });

  test("discard clears storage so a reload is blank and not resumed", () => {
    const { unmount } = render(<CreateProject />);
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Throwaway" },
    });
    fireEvent.click(screen.getByRole("button", { name: /discard draft/i }));
    expect(screen.queryByDisplayValue("Throwaway")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("devsync.projectDraft.v1")).toBeNull();
    unmount();

    render(<CreateProject />);
    expect(screen.queryByText(/resumed from your previously saved draft/i)).not.toBeInTheDocument();
    expect((screen.getByLabelText("Project name") as HTMLInputElement).value).toBe("");
  });

  test("shows plan-quality guidance for incomplete project details", () => {
    render(<CreateProject />);
    expect(screen.getByText(/need attention/i)).toBeInTheDocument();
    expect(screen.getByText("Add a project name.")).toBeInTheDocument();
    expect(screen.getByText(/add deliverables/i)).toBeInTheDocument();
  });

  test("starts specification import from the project plan", () => {
    render(<CreateProject />);
    const importLink = screen.getByRole("link", { name: /import specification/i });
    expect(importLink).toHaveAttribute("href", "/projects/new/import");
  });

  test("continues from plan details to integration setup", () => {
    render(<CreateProject />);
    fillRequiredPlan();

    const continueLink = screen.getByRole("link", { name: /continue to integrations/i });
    expect(continueLink).toHaveAttribute("href", "/projects/new/integrations");

    const warningsCard = screen.getByText(/ready to continue/i);
    expect(warningsCard).toBeInTheDocument();
    expect(within(document.body).queryByText(/required item/i)).not.toBeInTheDocument();
  });

  test("shows hierarchy legend copy", () => {
    render(<CreateProject />);
    expect(screen.getByText(/features = what/i)).toBeInTheDocument();
  });

  test("fills an example Campus Cart plan", async () => {
    const user = userEvent.setup();
    render(<CreateProject />);
    await user.click(screen.getByRole("button", { name: /fill example plan/i }));
    expect(screen.getByDisplayValue("Campus Cart")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /continue to integrations/i })).toBeInTheDocument();
  });

  test("fills the example without confirming after the draft is cleared", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<CreateProject />);
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Temp" } });
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "" } });

    await user.click(screen.getByRole("button", { name: /fill example plan/i }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Campus Cart")).toBeInTheDocument();
  });

  test("confirms before replacing an existing draft with the example", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<CreateProject />);
    fillRequiredPlan();
    await user.click(screen.getByRole("button", { name: /fill example plan/i }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue("Listings and search")).toBeInTheDocument();
    confirmSpy.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: /fill example plan/i }));
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(screen.queryByDisplayValue("Listings and search")).not.toBeInTheDocument();
  });
});
