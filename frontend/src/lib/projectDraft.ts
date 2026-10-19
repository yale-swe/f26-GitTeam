// Client-side model for the project onboarding page (/projects/new).
// This is intentionally UI-shaped: it holds the editable draft a team builds
// before the project exists on the backend. `toProjectCreate` maps it onto the
// `ProjectCreate` contract from PROJECT_SPEC.md section 10.4 so wiring up
// `POST /projects` later is a drop-in change.

export type DraftFeature = {
  id: string;
  title: string;
  detail: string;
  owner: string;
};

export type DraftMilestone = {
  id: string;
  title: string;
  detail: string;
  /** Target date as an ISO calendar date, e.g. "2026-10-31". Empty while unset. */
  date: string;
};

export type DraftDeliverable = {
  id: string;
  title: string;
  owner: string;
  /** Optional link to a milestone. UI-only; dropped when sent to the backend. */
  milestoneId: string | null;
};

export type PlanDraft = {
  name: string;
  summary: string;
  /** Target deadline as an ISO calendar date, e.g. "2026-10-31". Empty while unset. */
  deadline: string;
  owner: string;
  team: string;
  features: DraftFeature[];
  milestones: DraftMilestone[];
  deliverables: DraftDeliverable[];
};

/** Shape posted to `POST /projects` (ProjectCreate). */
export type ProjectCreatePayload = {
  name: string;
  summary: string;
  features: string[];
  deliverables: string[];
  milestones: { title: string; dueAt: string }[];
};

export type ValidationResult = {
  /** Blocking problems that must be fixed before the plan can continue. */
  errors: string[];
  /** Non-blocking suggestions that improve plan quality. */
  warnings: string[];
};

export type QualityCheck = {
  label: string;
  done: boolean;
  note?: string;
};

let idCounter = 0;

/** Generate a stable-enough unique id for draft list items. */
export function createId(prefix: string): string {
  idCounter += 1;
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${idCounter}`;
  return `${prefix}-${random}`;
}

export function emptyFeature(): DraftFeature {
  return { id: createId("feature"), title: "", detail: "", owner: "" };
}

export function emptyMilestone(): DraftMilestone {
  return { id: createId("milestone"), title: "", detail: "", date: "" };
}

export function emptyDeliverable(): DraftDeliverable {
  return { id: createId("deliverable"), title: "", owner: "", milestoneId: null };
}

/** A brand-new, empty plan draft. */
export function emptyDraft(): PlanDraft {
  return {
    name: "",
    summary: "",
    deadline: "",
    owner: "",
    team: "",
    features: [emptyFeature()],
    milestones: [emptyMilestone()],
    deliverables: [],
  };
}

function isValidDate(value: string): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return !Number.isNaN(time);
}

/**
 * Split validation into blocking errors (mirrors the backend ProjectCreate
 * rules) and non-blocking warnings (plan-quality guidance).
 */
export function validatePlan(draft: PlanDraft): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!draft.name.trim()) {
    errors.push("Add a project name.");
  }
  if (!draft.summary.trim()) {
    errors.push("Describe what you are building in the summary.");
  }

  const namedFeatures = draft.features.filter((f) => f.title.trim());
  if (namedFeatures.length === 0) {
    errors.push("Add at least one feature.");
  }

  const namedMilestones = draft.milestones.filter((m) => m.title.trim());
  if (namedMilestones.length === 0) {
    errors.push("Add at least one milestone.");
  }

  const datedMilestones = namedMilestones.filter((m) => m.date);
  if (namedMilestones.length > 0 && datedMilestones.length === 0) {
    errors.push("Give at least one milestone a target date.");
  }

  const invalidDates = namedMilestones.filter((m) => m.date && !isValidDate(m.date));
  if (invalidDates.length > 0) {
    errors.push("Fix milestone dates that are not valid.");
  }

  // Warnings: plan quality, never blocking.
  if (namedFeatures.length > 0 && namedFeatures.length < 3) {
    warnings.push("Teams usually define at least 3 major features.");
  }

  const featuresMissingOwner = namedFeatures.filter((f) => !f.owner.trim());
  if (featuresMissingOwner.length > 0) {
    warnings.push(
      `${featuresMissingOwner.length} feature${featuresMissingOwner.length === 1 ? "" : "s"} missing an owner.`,
    );
  }

  const deliverablesMissingOwner = draft.deliverables
    .filter((d) => d.title.trim())
    .filter((d) => !d.owner.trim());
  if (deliverablesMissingOwner.length > 0) {
    warnings.push(
      `${deliverablesMissingOwner.length} deliverable${deliverablesMissingOwner.length === 1 ? "" : "s"} missing an owner.`,
    );
  }

  if (draft.deliverables.filter((d) => d.title.trim()).length === 0) {
    warnings.push("Add deliverables so milestones have concrete outcomes.");
  }

  const deadlineTime = isValidDate(draft.deadline) ? new Date(draft.deadline).getTime() : null;
  if (deadlineTime !== null && deadlineTime < Date.now()) {
    warnings.push("The target deadline is already in the past.");
  }

  if (deadlineTime !== null) {
    const lateMilestones = datedMilestones.filter(
      (m) => isValidDate(m.date) && new Date(m.date).getTime() > deadlineTime,
    );
    if (lateMilestones.length > 0) {
      warnings.push("Some milestones are scheduled after the project deadline.");
    }
  }

  const validDatedTimes = datedMilestones
    .filter((m) => isValidDate(m.date))
    .map((m) => new Date(m.date).getTime());
  const sortedTimes = [...validDatedTimes].sort((a, b) => a - b);
  const outOfOrder = validDatedTimes.some((time, i) => time !== sortedTimes[i]);
  if (outOfOrder) {
    warnings.push("Milestones are not in chronological order.");
  }

  return { errors, warnings };
}

/** Derived checklist for the plan-quality card. */
export function planQualityChecks(draft: PlanDraft): QualityCheck[] {
  const namedFeatures = draft.features.filter((f) => f.title.trim());
  const namedMilestones = draft.milestones.filter((m) => m.title.trim());
  const datedMilestones = namedMilestones.filter((m) => m.date && isValidDate(m.date));
  const namedDeliverables = draft.deliverables.filter((d) => d.title.trim());
  const deliverablesWithoutOwner = namedDeliverables.filter((d) => !d.owner.trim());

  return [
    {
      label: "Outcome is clear",
      done: draft.name.trim().length > 0 && draft.summary.trim().length >= 40,
      note:
        draft.summary.trim().length > 0 && draft.summary.trim().length < 40
          ? "Add more detail to the summary"
          : undefined,
    },
    {
      label: "3 major features defined",
      done: namedFeatures.length >= 3,
      note: namedFeatures.length < 3 ? `${namedFeatures.length} of 3 features defined` : undefined,
    },
    {
      label: "Milestones have target dates",
      done: namedMilestones.length > 0 && datedMilestones.length === namedMilestones.length,
      note:
        namedMilestones.length > datedMilestones.length
          ? `${namedMilestones.length - datedMilestones.length} milestone(s) missing a date`
          : undefined,
    },
    {
      label: "Every deliverable has an owner",
      done: namedDeliverables.length > 0 && deliverablesWithoutOwner.length === 0,
      note:
        deliverablesWithoutOwner.length > 0
          ? `${deliverablesWithoutOwner.length} deliverable(s) still unassigned`
          : namedDeliverables.length === 0
            ? "No deliverables added yet"
            : undefined,
    },
  ];
}

/** True when the plan has no blocking errors and can advance to integrations. */
export function canContinue(draft: PlanDraft): boolean {
  return validatePlan(draft).errors.length === 0;
}

/**
 * Map the UI draft onto the backend ProjectCreate contract.
 * Empty rows are dropped and milestone calendar dates become ISO date-times.
 */
export function toProjectCreate(draft: PlanDraft): ProjectCreatePayload {
  const features = draft.features
    .map((f) => f.title.trim())
    .filter((title) => title.length > 0);

  const deliverables = draft.deliverables
    .map((d) => d.title.trim())
    .filter((title) => title.length > 0);

  const milestones = draft.milestones
    .filter((m) => m.title.trim() && m.date && isValidDate(m.date))
    .map((m) => ({
      title: m.title.trim(),
      dueAt: new Date(m.date).toISOString(),
    }));

  return {
    name: draft.name.trim(),
    summary: draft.summary.trim(),
    features,
    deliverables,
    milestones,
  };
}
