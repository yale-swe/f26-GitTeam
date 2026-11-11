import { describe, expect, test } from "vitest";

import {
  canContinue,
  emptyDeliverable,
  emptyDraft,
  exampleCampusCartDraft,
  formatLocalDate,
  moveDeliverable,
  normalizeDraft,
  parseLocalDate,
  planQualityChecks,
  removeMilestoneFromDraft,
  toLocalDateISO,
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
    discordChannels: [],
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
    expect(validatePlan(draft).errors).toContain("Give every milestone a valid target date.");
  });

  test("any named milestone missing a date blocks, even if another is dated", () => {
    const draft = completePlan();
    // "Beta" has deliverables but no date; this used to pass validation and
    // then get silently dropped on create.
    draft.milestones = [
      { id: "m1", title: "Core", detail: "", date: "2030-10-10" },
      { id: "m2", title: "Beta", detail: "", date: "" },
    ];
    draft.deliverables = [{ id: "d1", title: "Beta work", owner: "Sam", milestoneId: "m2" }];
    const { errors } = validatePlan(draft);
    expect(errors).toContain("Give every milestone a valid target date.");
    expect(errors).toContain(
      "Every deliverable must belong to a milestone with a title and a valid target date.",
    );
    expect(canContinue(draft)).toBe(false);
  });

  test("a deliverable on an untitled milestone blocks create", () => {
    const draft = completePlan();
    draft.milestones.push({ id: "m3", title: "  ", detail: "", date: "2030-10-20" });
    draft.deliverables = [
      { id: "d1", title: "Hidden work", owner: "Sam", milestoneId: "m3" },
    ];
    const { errors } = validatePlan(draft);
    expect(errors).toContain(
      "Every deliverable must belong to a milestone with a title and a valid target date.",
    );
    expect(canContinue(draft)).toBe(false);
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
    draft.deliverables = [{ id: "d1", title: "Auth", owner: "", milestoneId: "m1" }];
    const check = planQualityChecks(draft).find((c) => c.label === "Every deliverable has an owner");
    expect(check?.done).toBe(false);
    expect(check?.note).toContain("unassigned");
  });
});

describe("toProjectCreate", () => {
  test("maps the draft to the backend contract and drops empty rows", () => {
    const draft = completePlan();
    draft.features.push({ id: "f4", title: "  ", detail: "", owner: "" });
    draft.deliverables.push({ id: "d2", title: "", owner: "", milestoneId: "m1" });

    const payload = toProjectCreate(draft);
    expect(payload.name).toBe("Campus Cart");
    expect(payload.features).toEqual(["Accounts", "Listings", "Checkout"]);
    expect(payload.milestones).toHaveLength(2);
    expect(payload.milestones[0]).toEqual({
      title: "Core",
      // Anchored to local midnight of the chosen calendar day.
      dueAt: toLocalDateISO("2030-10-10"),
      deliverables: [{ title: "Auth service" }],
    });
    expect(payload.milestones[1].deliverables).toEqual([]);
    // Top-level deliverables are no longer part of the contract.
    expect("deliverables" in payload).toBe(false);
  });

  test("nests a deliverable under its linked milestone", () => {
    const draft = completePlan();
    draft.deliverables = [
      { id: "d1", title: "Checkout flow", owner: "", milestoneId: "m2" },
    ];
    const payload = toProjectCreate(draft);
    expect(payload.milestones[0].deliverables).toEqual([]);
    expect(payload.milestones[1].deliverables).toEqual([{ title: "Checkout flow" }]);
  });

  test("drops a deliverable whose milestone is excluded instead of reassigning it", () => {
    const draft = completePlan();
    // d1 links to m3, which has no date and is excluded from the payload.
    // validatePlan blocks this before create; this asserts we still do not
    // reassign the deliverable if toProjectCreate is called directly.
    draft.milestones.push({ id: "m3", title: "No date", detail: "", date: "" });
    draft.deliverables = [
      { id: "d1", title: "Orphan deliverable", owner: "", milestoneId: "m3" },
    ];
    const payload = toProjectCreate(draft);
    expect(payload.milestones).toHaveLength(2);
    expect(payload.milestones[0].deliverables).toEqual([]);
    expect(payload.milestones[1].deliverables).toEqual([]);
  });

  test("excludes milestones without a valid date", () => {
    const draft = completePlan();
    draft.milestones.push({ id: "m3", title: "No date", detail: "", date: "" });
    expect(toProjectCreate(draft).milestones).toHaveLength(2);
  });
});

describe("local calendar dates", () => {
  // Regression for the UTC-midnight bug: a "YYYY-MM-DD" value must represent the
  // same calendar day the user picked, regardless of the runtime timezone. These
  // assertions are timezone-independent; run under TZ=America/New_York to mirror
  // the reported case.
  test("parseLocalDate keeps the picked calendar day", () => {
    const date = parseLocalDate("2030-10-10");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2030);
    expect(date?.getMonth()).toBe(9); // October (0-indexed)
    expect(date?.getDate()).toBe(10);
  });

  test("parseLocalDate rejects empty and non-calendar dates", () => {
    expect(parseLocalDate("")).toBeNull();
    expect(parseLocalDate("not-a-date")).toBeNull();
    expect(parseLocalDate("2030-02-31")).toBeNull();
  });

  test("formatLocalDate does not shift the day", () => {
    expect(formatLocalDate("2030-10-10")).toContain("10");
    expect(formatLocalDate("2030-10-10")).toContain("2030");
    expect(formatLocalDate("")).toBe("No date");
  });

  test("toLocalDateISO round-trips to the same local calendar day", () => {
    const iso = toLocalDateISO("2030-10-10");
    const back = new Date(iso);
    expect(back.getFullYear()).toBe(2030);
    expect(back.getMonth()).toBe(9);
    expect(back.getDate()).toBe(10);
  });
});

describe("draft helpers", () => {
  test("emptyDeliverable requires a milestone id", () => {
    const d = emptyDeliverable("m1");
    expect(d.milestoneId).toBe("m1");
  });

  test("normalizeDraft attaches orphan deliverables to the first milestone", () => {
    const draft = completePlan();
    // Legacy drafts may have a null link; normalizeDraft repairs them on hydrate.
    draft.deliverables = [
      { id: "d1", title: "Loose", owner: "", milestoneId: null as unknown as string },
    ];
    const next = normalizeDraft(draft);
    expect(next.deliverables[0].milestoneId).toBe("m1");
  });

  test("normalizeDraft attaches deliverables pointing at a missing milestone to the first milestone", () => {
    const draft = completePlan();
    draft.deliverables = [{ id: "d1", title: "Stale", owner: "", milestoneId: "deleted-m" }];
    const next = normalizeDraft(draft);
    expect(next.deliverables[0].milestoneId).toBe("m1");
  });

  test("removeMilestoneFromDraft removes the milestone and its deliverables", () => {
    const draft = completePlan(); // d1 linked to m1
    const next = removeMilestoneFromDraft(draft, "m1");
    expect(next.milestones.find((m) => m.id === "m1")).toBeUndefined();
    expect(next.deliverables.find((d) => d.id === "d1")).toBeUndefined();
  });

  test("moveDeliverable updates milestoneId", () => {
    const draft = completePlan();
    const next = moveDeliverable(draft, "d1", "m2");
    expect(next.deliverables.find((d) => d.id === "d1")?.milestoneId).toBe("m2");
  });

  test("exampleCampusCartDraft is a continuable nested plan", () => {
    const draft = exampleCampusCartDraft();
    expect(canContinue(draft)).toBe(true);
    expect(draft.deliverables.every((d) => d.milestoneId)).toBe(true);
  });
});
