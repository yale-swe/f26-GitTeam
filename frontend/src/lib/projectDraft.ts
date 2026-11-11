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
  /** Milestone this deliverable belongs to. Deliverables are always created
   * inside a milestone, so this is always set. */
  milestoneId: string;
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
 * Merge missing draft fields onto empty-draft defaults, then repair any titled
 * deliverable whose milestone link is missing or stale (e.g. legacy drafts
 * saved when the link was optional) by attaching it to the first milestone so
 * old drafts hydrate without silently dropping text.
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
      (!d.milestoneId || !milestoneIds.has(d.milestoneId)) && d.title.trim()
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

/** Plan-quality thresholds, named so the rules can't drift across call sites. */
export const MIN_FEATURES_FOR_QUALITY = 3;
export const MIN_SUMMARY_LENGTH = 40;

/**
 * Parse a `YYYY-MM-DD` calendar date as a *local* date (midnight local time).
 * Using `new Date("YYYY-MM-DD")` would parse as UTC midnight, which is the
 * previous evening in US timezones and shifts the displayed/compared day.
 * Returns null when the value is empty or not a real calendar date.
 */
export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  // Reject non-calendar dates like 2030-02-31 (which JS would roll over).
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Format a `YYYY-MM-DD` calendar date for display, parsed in local time. */
export function formatLocalDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string {
  const date = parseLocalDate(value);
  if (!date) return "No date";
  return date.toLocaleDateString(undefined, options);
}

/**
 * Build the ISO date-time sent as a milestone `dueAt`. Anchored to local
 * midnight of the chosen calendar day so the backend receives the day the user
 * actually picked (not the previous day via a UTC-midnight shift).
 */
export function toLocalDateISO(value: string): string {
  const date = parseLocalDate(value);
  if (!date) throw new Error(`Invalid calendar date: ${value}`);
  return date.toISOString();
}

function isValidDate(value: string): boolean {
  return parseLocalDate(value) !== null;
}

/** Features with a non-empty title. */
export function namedFeatures(draft: PlanDraft): DraftFeature[] {
  return draft.features.filter((f) => f.title.trim());
}

/** Milestones with a non-empty title. */
export function namedMilestones(draft: PlanDraft): DraftMilestone[] {
  return draft.milestones.filter((m) => m.title.trim());
}

/** Named milestones that also have a valid calendar date. */
export function datedMilestones(draft: PlanDraft): DraftMilestone[] {
  return namedMilestones(draft).filter((m) => isValidDate(m.date));
}

/** Deliverables with a non-empty title. */
export function namedDeliverables(draft: PlanDraft): DraftDeliverable[] {
  return draft.deliverables.filter((d) => d.title.trim());
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

  const features = namedFeatures(draft);
  if (features.length === 0) {
    errors.push("Add at least one feature.");
  }

  const milestones = namedMilestones(draft);
  if (milestones.length === 0) {
    errors.push("Add at least one milestone.");
  }

  // Every milestone that has a title must also have a valid date. Otherwise the
  // review page shows it (e.g. "Beta — No date") but create silently drops it.
  const undatedMilestones = milestones.filter((m) => !isValidDate(m.date));
  if (undatedMilestones.length > 0) {
    errors.push("Give every milestone a valid target date.");
  }

  const dated = datedMilestones(draft);

  // A titled deliverable whose milestone is missing, untitled, or undated would
  // be dropped by toProjectCreate. Block that instead of losing the text.
  const includedMilestoneIds = new Set(dated.map((m) => m.id));
  const deliverables = namedDeliverables(draft);
  if (deliverables.some((d) => !includedMilestoneIds.has(d.milestoneId))) {
    errors.push(
      "Every deliverable must belong to a milestone with a title and a valid target date.",
    );
  }

  // Warnings: plan quality, never blocking.
  if (features.length > 0 && features.length < MIN_FEATURES_FOR_QUALITY) {
    warnings.push(`Teams usually define at least ${MIN_FEATURES_FOR_QUALITY} major features.`);
  }

  const featuresMissingOwner = features.filter((f) => !f.owner.trim());
  if (featuresMissingOwner.length > 0) {
    warnings.push(
      `${featuresMissingOwner.length} feature${featuresMissingOwner.length === 1 ? "" : "s"} missing an owner.`,
    );
  }

  const deliverablesMissingOwner = deliverables.filter((d) => !d.owner.trim());
  if (deliverablesMissingOwner.length > 0) {
    warnings.push(
      `${deliverablesMissingOwner.length} deliverable${deliverablesMissingOwner.length === 1 ? "" : "s"} missing an owner.`,
    );
  }

  if (deliverables.length === 0) {
    warnings.push("Add deliverables so milestones have concrete outcomes.");
  }

  const deadline = parseLocalDate(draft.deadline);
  const deadlineTime = deadline ? deadline.getTime() : null;
  if (deadlineTime !== null && deadlineTime < Date.now()) {
    warnings.push("The target deadline is already in the past.");
  }

  if (deadlineTime !== null) {
    const lateMilestones = dated.filter((m) => {
      const t = parseLocalDate(m.date)?.getTime();
      return t !== undefined && t > deadlineTime;
    });
    if (lateMilestones.length > 0) {
      warnings.push("Some milestones are scheduled after the project deadline.");
    }
  }

  const validDatedTimes = dated
    .map((m) => parseLocalDate(m.date)?.getTime())
    .filter((t): t is number => t !== undefined);
  const sortedTimes = [...validDatedTimes].sort((a, b) => a - b);
  const outOfOrder = validDatedTimes.some((time, i) => time !== sortedTimes[i]);
  if (outOfOrder) {
    warnings.push("Milestones are not in chronological order.");
  }

  return { errors, warnings };
}

/** Derived checklist for the plan-quality card. */
export function planQualityChecks(draft: PlanDraft): QualityCheck[] {
  const features = namedFeatures(draft);
  const milestones = namedMilestones(draft);
  const dated = datedMilestones(draft);
  const deliverables = namedDeliverables(draft);
  const deliverablesWithoutOwner = deliverables.filter((d) => !d.owner.trim());

  return [
    {
      label: "Outcome is clear",
      done: draft.name.trim().length > 0 && draft.summary.trim().length >= MIN_SUMMARY_LENGTH,
      note:
        draft.summary.trim().length > 0 && draft.summary.trim().length < MIN_SUMMARY_LENGTH
          ? "Add more detail to the summary"
          : undefined,
    },
    {
      label: `${MIN_FEATURES_FOR_QUALITY} major features defined`,
      done: features.length >= MIN_FEATURES_FOR_QUALITY,
      note:
        features.length < MIN_FEATURES_FOR_QUALITY
          ? `${features.length} of ${MIN_FEATURES_FOR_QUALITY} features defined`
          : undefined,
    },
    {
      label: "Milestones have target dates",
      done: milestones.length > 0 && dated.length === milestones.length,
      note:
        milestones.length > dated.length
          ? `${milestones.length - dated.length} milestone(s) missing a date`
          : undefined,
    },
    {
      label: "Every deliverable has an owner",
      done: deliverables.length > 0 && deliverablesWithoutOwner.length === 0,
      note:
        deliverablesWithoutOwner.length > 0
          ? `${deliverablesWithoutOwner.length} deliverable(s) still unassigned`
          : deliverables.length === 0
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
 * True when the user has entered something worth persisting. Used so we never
 * save (and later "resume") a draft nobody actually filled in.
 */
export function draftHasContent(draft: PlanDraft): boolean {
  return (
    draft.name.trim().length > 0 ||
    draft.summary.trim().length > 0 ||
    draft.deadline.trim().length > 0 ||
    draft.owner.trim().length > 0 ||
    draft.team.trim().length > 0 ||
    draft.features.some((f) => f.title.trim() || f.detail.trim() || f.owner.trim()) ||
    draft.milestones.some((m) => m.title.trim() || m.detail.trim() || m.date.trim()) ||
    draft.deliverables.some((d) => d.title.trim() || d.owner.trim()) ||
    draft.discordChannels.length > 0
  );
}

/**
 * Map the UI draft onto the backend ProjectCreate contract. Empty rows are
 * dropped and milestone calendar dates become local-anchored ISO date-times.
 * Deliverables are nested under their own milestone; `validatePlan` guarantees
 * every titled milestone has a valid date before create, so there is no silent
 * reassignment of deliverables to a different milestone here.
 */
export function toProjectCreate(draft: PlanDraft): ProjectCreatePayload {
  const features = namedFeatures(draft).map((f) => f.title.trim());

  const includedMilestones = draft.milestones.filter(
    (m) => m.title.trim() && isValidDate(m.date),
  );

  const milestones: ProjectCreateMilestone[] = includedMilestones.map((m) => ({
    title: m.title.trim(),
    dueAt: toLocalDateISO(m.date),
    deliverables: [],
  }));

  // Index by draft milestone id so deliverables can be bucketed under their own
  // milestone (no cross-milestone fallback).
  const milestoneByDraftId = new Map<string, ProjectCreateMilestone>();
  includedMilestones.forEach((m, i) => milestoneByDraftId.set(m.id, milestones[i]));

  for (const deliverable of namedDeliverables(draft)) {
    const linked = milestoneByDraftId.get(deliverable.milestoneId);
    // validatePlan rejects this state. If create is called anyway, drop the
    // deliverable rather than attaching it to a different milestone.
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
