import { describe, expect, test } from "vitest";

import {
  canContinue,
  emptyDraft,
  planQualityChecks,
  toProjectCreate,
  validatePlan,
  type PlanDraft,
} from "@/lib/projectDraft";

function completePlan(): PlanDraft {
  return {
    name: "Campus Cart",
    summary:
      "A web marketplace where students can list, discover, and purchase used textbooks from verified campus peers.",
    deadline: "2030-10-31",
    owner: "Alex Morgan",
    team: "CS 424 Team 7",
    features: [
      { id: "f1", title: "Accounts", detail: "Email verification", owner: "Jamie" },
      { id: "f2", title: "Listings", detail: "Create listings", owner: "Sam" },
      { id: "f3", title: "Checkout", detail: "Reserve items", owner: "Alex" },
    ],
    milestones: [
      { id: "m1", title: "Core", detail: "Auth", date: "2030-10-10" },
      { id: "m2", title: "Beta", detail: "Checkout", date: "2030-10-18" },
    ],
    deliverables: [
      { id: "d1", title: "Auth service", owner: "Jamie", milestoneId: "m1" },
    ],
  };
}

describe("validatePlan", () => {
  test("an empty draft reports the required blocking errors", () => {
    const { errors } = validatePlan(emptyDraft());
    expect(errors).toContain("Add a project name.");
    expect(errors).toContain("Describe what you are building in the summary.");
    expect(errors).toContain("Add at least one feature.");
    expect(errors).toContain("Add at least one milestone.");
  });

  test("a complete plan has no blocking errors", () => {
    expect(validatePlan(completePlan()).errors).toHaveLength(0);
    expect(canContinue(completePlan())).toBe(true);
  });

  test("a named milestone without a date is a blocking error", () => {
    const draft = completePlan();
    draft.milestones = [{ id: "m1", title: "Core", detail: "", date: "" }];
    expect(validatePlan(draft).errors).toContain("Give at least one milestone a target date.");
  });

  test("fewer than three features is a non-blocking warning", () => {
    const draft = completePlan();
    draft.features = draft.features.slice(0, 1);
    const { errors, warnings } = validatePlan(draft);
    expect(errors).toHaveLength(0);
    expect(warnings).toContain("Teams usually define at least 3 major features.");
  });

  test("a milestone after the deadline warns but does not block", () => {
    const draft = completePlan();
    draft.deadline = "2030-10-15";
    const { errors, warnings } = validatePlan(draft);
    expect(errors).toHaveLength(0);
    expect(warnings).toContain("Some milestones are scheduled after the project deadline.");
  });

  test("milestones out of chronological order produce a warning", () => {
    const draft = completePlan();
    draft.milestones = [
      { id: "m1", title: "Later", detail: "", date: "2030-10-20" },
      { id: "m2", title: "Earlier", detail: "", date: "2030-10-05" },
    ];
    expect(validatePlan(draft).warnings).toContain("Milestones are not in chronological order.");
  });
});

describe("planQualityChecks", () => {
  test("marks checks done for a complete plan", () => {
    const checks = planQualityChecks(completePlan());
    expect(checks.find((c) => c.label === "3 major features defined")?.done).toBe(true);
    expect(checks.find((c) => c.label === "Milestones have target dates")?.done).toBe(true);
  });

  test("flags an unassigned deliverable", () => {
    const draft = completePlan();
    draft.deliverables = [{ id: "d1", title: "Auth", owner: "", milestoneId: null }];
    const check = planQualityChecks(draft).find((c) => c.label === "Every deliverable has an owner");
    expect(check?.done).toBe(false);
    expect(check?.note).toContain("unassigned");
  });
});

describe("toProjectCreate", () => {
  test("maps the draft to the backend contract and drops empty rows", () => {
    const draft = completePlan();
    draft.features.push({ id: "f4", title: "  ", detail: "", owner: "" });
    draft.deliverables.push({ id: "d2", title: "", owner: "", milestoneId: null });

    const payload = toProjectCreate(draft);
    expect(payload.name).toBe("Campus Cart");
    expect(payload.features).toEqual(["Accounts", "Listings", "Checkout"]);
    expect(payload.deliverables).toEqual(["Auth service"]);
    expect(payload.milestones).toHaveLength(2);
    expect(payload.milestones[0]).toEqual({
      title: "Core",
      dueAt: new Date("2030-10-10").toISOString(),
    });
  });

  test("excludes milestones without a valid date", () => {
    const draft = completePlan();
    draft.milestones.push({ id: "m3", title: "No date", detail: "", date: "" });
    expect(toProjectCreate(draft).milestones).toHaveLength(2);
  });
});
