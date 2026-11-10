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
  /** Target date as an ISO calendar date, e.g. "2030-10-31". Empty while unset. */
  date: string;
};

export type DraftDeliverable = {
  id: string;
  title: string;
  owner: string;
  /** Optional link to a milestone. UI-only; dropped when sent to the backend. */
  milestoneId: string | null;
};

/** A Discord channel the team selected during onboarding. */
export type DraftDiscordChannel = {
  guildId: string;
  channelId: string;
  guildName: string;
  channelName: string;
};

export type PlanDraft = {
  name: string;
  summary: string;
  /** Target deadline as an ISO calendar date, e.g. "2030-10-31". Empty while unset. */
  deadline: string;
  owner: string;
  team: string;
  features: DraftFeature[];
  milestones: DraftMilestone[];
  deliverables: DraftDeliverable[];
  /** Discord channels selected on the integrations step, attached after create. */
  discordChannels: DraftDiscordChannel[];
};

/** A deliverable nested under a milestone in the backend ProjectCreate contract. */
export type ProjectCreateDeliverable = {
  title: string;
};

/** A milestone in the backend ProjectCreate contract. */
export type ProjectCreateMilestone = {
  title: string;
  dueAt: string;
  deliverables: ProjectCreateDeliverable[];
};

/** Shape posted to `POST /api/projects` (ProjectCreate). */
export type ProjectCreatePayload = {
  name: string;
  summary: string;
  features: string[];
  milestones: ProjectCreateMilestone[];
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

export function emptyDeliverable(milestoneId: string): DraftDeliverable {
  return { id: createId("deliverable"), title: "", owner: "", milestoneId };
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
    discordChannels: [],
  };
}

/** A realistic nested Campus Cart plan for demos and review. */
export function exampleCampusCartDraft(): PlanDraft {
  const core = emptyMilestone();
  const beta = emptyMilestone();
  const release = emptyMilestone();

  return {
    name: "Campus Cart",
    summary:
      "Campus Cart is a campus-only marketplace that helps students buy and sell used textbooks and dorm essentials, reducing cost and waste while improving trust through university email verification.",
    deadline: "2030-10-31",
    owner: "Alex Morgan",
    team: "CS 424 Team 7",
    features: [
      {
        ...emptyFeature(),
        title: "Verified student accounts",
        detail: "Sign up with a university email, create a profile, and show campus affiliation.",
        owner: "Jamie Kim",
      },
      {
        ...emptyFeature(),
        title: "Listings and discovery",
        detail: "Create listings with photos, condition, price, category, and searchable tags.",
        owner: "Sam Rivera",
      },
      {
        ...emptyFeature(),
        title: "Reservation and exchange",
        detail: "Reserve an item, notify the seller, and coordinate an on-campus handoff.",
        owner: "Alex Morgan",
      },
      {
        ...emptyFeature(),
        title: "Moderation and reports",
        detail: "Report suspicious listings and provide a basic moderation queue.",
        owner: "Jamie Kim",
      },
    ],
    milestones: [
      {
        ...core,
        title: "Core marketplace",
        detail: "Authentication, listing creation, browse and search",
        date: "2030-10-10",
      },
      {
        ...beta,
        title: "Beta checkout",
        detail: "Reservation flow, seller notification, exchange details",
        date: "2030-10-18",
      },
      {
        ...release,
        title: "Final release",
        detail: "QA, accessibility checks, deployment, final report",
        date: "2030-10-31",
      },
    ],
    deliverables: [
      {
        ...emptyDeliverable(core.id),
        title: "Campus email verification",
        owner: "Jamie Kim",
      },
      {
        ...emptyDeliverable(core.id),
        title: "Listing creation and search",
        owner: "Sam Rivera",
      },
      {
        ...emptyDeliverable(beta.id),
        title: "Listing image upload",
        owner: "Sam Rivera",
      },
      {
        ...emptyDeliverable(beta.id),
        title: "Reservation flow",
        owner: "Alex Morgan",
      },
      {
        ...emptyDeliverable(beta.id),
        title: "Seller notifications",
        owner: "Alex Morgan",
      },
      {
        ...emptyDeliverable(release.id),
        title: "QA and accessibility checks",
        owner: "Jamie Kim",
      },
      {
        ...emptyDeliverable(release.id),
        title: "Deployment and final report",
        owner: "Alex Morgan",
      },
    ],
    discordChannels: [],
  };
}

/**
 * Merge missing draft fields onto empty-draft defaults, then attach titled
 * deliverables with no milestone to the first milestone so old drafts hydrate
 * without silently dropping text.
 */
export function normalizeDraft(draft: PlanDraft): PlanDraft {
  const defaults = emptyDraft();
  const merged: PlanDraft = {
    ...defaults,
    ...draft,
    features: draft.features ?? defaults.features,
    milestones: draft.milestones ?? defaults.milestones,
    deliverables: draft.deliverables ?? defaults.deliverables,
    discordChannels: draft.discordChannels ?? defaults.discordChannels,
  };

  const firstMilestoneId = merged.milestones[0]?.id;
  if (!firstMilestoneId) return merged;

  const milestoneIds = new Set(merged.milestones.map((m) => m.id));
  return {
    ...merged,
    deliverables: merged.deliverables.map((d) =>
      (d.milestoneId === null || !milestoneIds.has(d.milestoneId)) && d.title.trim()
        ? { ...d, milestoneId: firstMilestoneId }
        : d,
    ),
  };
}

/** Remove a milestone and every deliverable attached to it. */
export function removeMilestoneFromDraft(draft: PlanDraft, milestoneId: string): PlanDraft {
  return {
    ...draft,
    milestones: draft.milestones.filter((m) => m.id !== milestoneId),
    deliverables: draft.deliverables.filter((d) => d.milestoneId !== milestoneId),
  };
}

/**
 * Reassign a deliverable to another milestone. When `index` is provided, place
 * it at that position among the target milestone's deliverables.
 */
export function moveDeliverable(
  draft: PlanDraft,
  deliverableId: string,
  targetMilestoneId: string,
  index?: number,
): PlanDraft {
  const current = draft.deliverables.find((d) => d.id === deliverableId);
  if (!current) return draft;

  const moved: DraftDeliverable = { ...current, milestoneId: targetMilestoneId };

  if (index === undefined) {
    return {
      ...draft,
      deliverables: draft.deliverables.map((d) => (d.id === deliverableId ? moved : d)),
    };
  }

  const others = draft.deliverables.filter((d) => d.id !== deliverableId);
  const result: DraftDeliverable[] = [];
  let inserted = false;
  let seenInTarget = 0;
  for (const d of others) {
    if (d.milestoneId === targetMilestoneId) {
      if (seenInTarget === index) {
        result.push(moved);
        inserted = true;
      }
      seenInTarget += 1;
    }
    result.push(d);
  }
  if (!inserted) result.push(moved);

  return { ...draft, deliverables: result };
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
 * Map the UI draft onto the backend ProjectCreate contract. Empty rows are
 * dropped and milestone calendar dates become ISO date-times. Deliverables are
 * nested under the milestone they are linked to; a deliverable whose milestone
 * link is missing (or points at an excluded/dateless milestone) is attached to
 * the first included milestone so no concrete outcome is silently dropped.
 */
export function toProjectCreate(draft: PlanDraft): ProjectCreatePayload {
  const features = draft.features
    .map((f) => f.title.trim())
    .filter((title) => title.length > 0);

  const includedMilestones = draft.milestones.filter(
    (m) => m.title.trim() && m.date && isValidDate(m.date),
  );
  const includedIds = new Set(includedMilestones.map((m) => m.id));

  const milestones: ProjectCreateMilestone[] = includedMilestones.map((m) => ({
    title: m.title.trim(),
    dueAt: new Date(m.date).toISOString(),
    deliverables: [],
  }));

  // Index by draft milestone id so deliverables can be bucketed in place.
  const milestoneByDraftId = new Map<string, ProjectCreateMilestone>();
  includedMilestones.forEach((m, i) => milestoneByDraftId.set(m.id, milestones[i]));

  const namedDeliverables = draft.deliverables.filter((d) => d.title.trim());
  for (const deliverable of namedDeliverables) {
    const linked =
      deliverable.milestoneId && includedIds.has(deliverable.milestoneId)
        ? milestoneByDraftId.get(deliverable.milestoneId)
        : milestones[0];
    // With no included milestones there is nowhere to attach; drop the row.
    if (!linked) continue;
    linked.deliverables.push({ title: deliverable.title.trim() });
  }

  return {
    name: draft.name.trim(),
    summary: draft.summary.trim(),
    features,
    milestones,
  };
}
