import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import CreateProject from "@/components/CreateProject/CreateProject";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
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

  test("adds, edits, and removes deliverables", async () => {
    const user = userEvent.setup();
    render(<CreateProject />);

    expect(screen.queryByLabelText("Deliverable")).not.toBeInTheDocument();
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
    fireEvent.click(screen.getAllByRole("button", { name: /save draft/i })[0]);
    unmount();

    render(<CreateProject />);
    expect((screen.getByLabelText("Project name") as HTMLInputElement).value).toBe("Half-finished");
    expect(screen.getByRole("button", { name: /discard draft/i })).toBeInTheDocument();
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
});
