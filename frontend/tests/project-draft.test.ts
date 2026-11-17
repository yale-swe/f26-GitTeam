import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { formatLongDate } from "@/lib/dashboardFormat";
import {
  canContinue,
  emptyDeliverable,
  emptyDraft,
  exampleCampusCartDraft,
  formatLocalDate,
  milestoneDateRange,
  moveDeliverable,
  normalizeDraft,
  parseLocalDate,
  planQualityChecks,
  removeMilestoneFromDraft,
  toDueAtISO,
  toProjectCreate,
  validatePlan,
  type PlanDraft,
} from "@/lib/projectDraft";

// Milestone dates must fall within two years of today; pin today so the 2030
// fixture dates stay valid.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2030, 0, 1, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

function completePlan(): PlanDraft {
  return {
    name: "Campus Cart",
    summary:
      "A web marketplace where students can list, discover, and purchase used textbooks from verified campus peers.",
    features: [
      { id: "f1", title: "Accounts" },
      { id: "f2", title: "Listings" },
      { id: "f3", title: "Checkout" },
    ],
    milestones: [
      { id: "m1", title: "Core", date: "2030-10-10" },
      { id: "m2", title: "Beta", date: "2030-10-18" },
    ],
    deliverables: [{ id: "d1", title: "Auth service", milestoneId: "m1" }],
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
    draft.milestones = [{ id: "m1", title: "Core", date: "" }];
    expect(validatePlan(draft).errors).toContain("Give every milestone a valid target date.");
  });

  test("any named milestone missing a date blocks, even if another is dated", () => {
    const draft = completePlan();
    // "Beta" has deliverables but no date; this used to pass validation and
    // then get silently dropped on create.
    draft.milestones = [
      { id: "m1", title: "Core", date: "2030-10-10" },
      { id: "m2", title: "Beta", date: "" },
    ];
    draft.deliverables = [{ id: "d1", title: "Beta work", milestoneId: "m2" }];
    const { errors } = validatePlan(draft);
    expect(errors).toContain("Give every milestone a valid target date.");
    expect(errors).toContain(
      "Every deliverable must belong to a milestone with a title and a valid target date.",
    );
    expect(canContinue(draft)).toBe(false);
  });

  test("a deliverable on an untitled milestone blocks create", () => {
    const draft = completePlan();
    draft.milestones.push({ id: "m3", title: "  ", date: "2030-10-20" });
    draft.deliverables = [
      { id: "d1", title: "Hidden work", milestoneId: "m3" },
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

  test("milestones out of chronological order produce a warning", () => {
    const draft = completePlan();
    draft.milestones = [
      { id: "m1", title: "Later", date: "2030-10-20" },
      { id: "m2", title: "Earlier", date: "2030-10-05" },
    ];
    expect(validatePlan(draft).warnings).toContain("Milestones are not in chronological order.");
  });

  test("a milestone dated before today is a blocking error", () => {
    const draft = completePlan();
    draft.milestones[0].date = "2029-12-31";
    expect(validatePlan(draft).errors).toContain("Milestone target dates can't be in the past.");
    expect(canContinue(draft)).toBe(false);
  });

  test("today and exactly two years out are allowed", () => {
    const draft = completePlan();
    draft.milestones[0].date = "2030-01-01";
    draft.milestones[1].date = "2032-01-01";
    expect(validatePlan(draft).errors).toHaveLength(0);
  });

  test("a milestone more than two years out is a blocking error", () => {
    const draft = completePlan();
    draft.milestones[1].date = "2032-01-02";
    expect(validatePlan(draft).errors).toContain(
      "Milestone target dates must be within 2 years of today.",
    );
    expect(canContinue(draft)).toBe(false);
  });

  test("the date range uses the local calendar day", () => {
    expect(milestoneDateRange(new Date(2030, 1, 28, 23, 30))).toEqual({
      min: "2030-02-28",
      max: "2032-02-28",
    });
  });
});

describe("planQualityChecks", () => {
  test("marks checks done for a complete plan", () => {
    const checks = planQualityChecks(completePlan());
    expect(checks.find((c) => c.label === "3 major features defined")?.done).toBe(true);
    expect(checks.find((c) => c.label === "Milestones have target dates")?.done).toBe(true);
  });

  test("flags a plan with no deliverables", () => {
    const draft = completePlan();
    draft.deliverables = [];
    const check = planQualityChecks(draft).find(
      (c) => c.label === "Deliverables name concrete outcomes",
    );
    expect(check?.done).toBe(false);
    expect(check?.note).toContain("No deliverables");
  });
});

describe("toProjectCreate", () => {
  test("maps the draft to the backend contract and drops empty rows", () => {
    const draft = completePlan();
    draft.features.push({ id: "f4", title: "  " });
    draft.deliverables.push({ id: "d2", title: "", milestoneId: "m1" });

    const payload = toProjectCreate(draft);
    expect(payload.name).toBe("Campus Cart");
    expect(payload.features).toEqual(["Accounts", "Listings", "Checkout"]);
    expect(payload.milestones).toHaveLength(2);
    expect(payload.milestones[0]).toEqual({
      title: "Core",
      dueAt: "2030-10-10T00:00:00.000Z",
      deliverables: [{ title: "Auth service" }],
    });
    expect(payload.milestones[1].deliverables).toEqual([]);
    // Top-level deliverables are no longer part of the contract.
    expect("deliverables" in payload).toBe(false);
  });

  test("nests a deliverable under its linked milestone", () => {
    const draft = completePlan();
    draft.deliverables = [
      { id: "d1", title: "Checkout flow", milestoneId: "m2" },
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
    draft.milestones.push({ id: "m3", title: "No date", date: "" });
    draft.deliverables = [
      { id: "d1", title: "Orphan deliverable", milestoneId: "m3" },
    ];
    const payload = toProjectCreate(draft);
    expect(payload.milestones).toHaveLength(2);
    expect(payload.milestones[0].deliverables).toEqual([]);
    expect(payload.milestones[1].deliverables).toEqual([]);
  });

  test("excludes milestones without a valid date", () => {
    const draft = completePlan();
    draft.milestones.push({ id: "m3", title: "No date", date: "" });
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

  test("toDueAtISO sends UTC midnight of the picked day, which UTC displays read back unchanged", () => {
    const iso = toDueAtISO("2030-10-10");
    expect(iso).toBe("2030-10-10T00:00:00.000Z");
    expect(formatLongDate(iso)).toBe("Oct 10, 2030");
    expect(() => toDueAtISO("2030-02-31")).toThrow();
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
      { id: "d1", title: "Loose", milestoneId: null as unknown as string },
    ];
    const next = normalizeDraft(draft);
    expect(next.deliverables[0].milestoneId).toBe("m1");
  });

  test("normalizeDraft attaches deliverables pointing at a missing milestone to the first milestone", () => {
    const draft = completePlan();
    draft.deliverables = [{ id: "d1", title: "Stale", milestoneId: "deleted-m" }];
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
