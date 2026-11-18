// Types for data returned by the DevSync API.
// These match the backend's Pydantic schemas in backend/app/schemas/.
// If the spec changes, update these types to match.

/** Dates arrive from the API as ISO 8601 text, e.g. "2026-10-18T00:00:00Z". */
export type IsoDateTime = string;

export type MilestoneStatus = "planned" | "in_progress" | "completed" | "at_risk";

export type Milestone = {
    id: string;
    title: string;
    dueAt: string;
    status: MilestoneStatus;
};

export type DeliverableStatus = "planned" | "in_progress" | "completed" | "blocked";

export type Deliverable = {
    id: string;
    milestoneId: string;
    title: string;
    status: DeliverableStatus;
};

/** A deliverable right after it was created or changed, with its milestone's new status. */
export type SavedDeliverable = Deliverable & { milestoneStatus: MilestoneStatus };

export type MilestoneProgress = {
    completed: number;
    total: number;
    percent: number;
};

/**
 * One milestone, from GET /api/projects/{projectId}/milestones/{milestoneId}.
 * `recentActivity` is the project's recent activity; it is not linked to this milestone.
 */
export type MilestoneDetail = {
    id: string;
    projectId: string;
    title: string;
    dueAt: string;
    status: MilestoneStatus;
    position: number;
    totalMilestones: number;
    progress: MilestoneProgress;
    deliverables: Deliverable[];
    recentActivity: ActivityItem[];
};

export type MilestoneUpdate = Partial<Pick<Milestone, "title" | "dueAt" | "status">>;

export type DeliverableUpdate = Partial<Pick<Deliverable, "title" | "status">>;

export type Project = {
    id: string;
    name: string;
    summary: string;
    features: string[];
    completedFeatures: string[];
    deliverables: Deliverable[];
    milestones: Milestone[];
};

/** A Discord channel the shared bot can read, from GET /api/discord/channels. */
export type DiscordChannelOption = {
    id: string;
    name: string;
};

/** A Discord guild (server) with its readable channels. */
export type DiscordGuildOption = {
    id: string;
    name: string;
    channels: DiscordChannelOption[];
};

export type IntegrationProvider = "github" | "discord";

export type IntegrationStatus = {
    provider: IntegrationProvider;
    status: "connected" | "syncing" | "healthy" | "stale" | "failed";
    lastSuccessfulSyncAt?: string | null;
};

/** A repository the DevSync GitHub App was given access to. */
export type GitHubRepository = {
    id: number;
    owner: string;
    name: string;
    fullName: string;
    defaultBranch: string;
    htmlUrl: string;
    private: boolean;
};

/** A project's GitHub connection. `repositories` is filled only by the connect call. */
export type GitHubIntegration = IntegrationStatus & {
    repository: GitHubRepository | null;
    repositories: GitHubRepository[];
    lastSyncError: string | null;
};

export type SyncResult = {
    provider: IntegrationProvider;
    status: IntegrationStatus["status"];
    importedCount: number;
};

export type ActivityItem = {
    id: string;
    source: IntegrationProvider;
    kind: string;
    occurredAt: string;
    title: string;
    url?: string | null;
};

export type Summary = {
    id: string;
    projectId: string;
    text: string;
    generatedAt: string;
};

/** Overall project health. */
export type HealthStatus = "healthy" | "at_risk" | "blocked" | "unknown";
export type AnalysisStatus = "current" | "stale" | "unavailable";

export type AnalysisEvidence = {
    evidenceId: string;
    evidenceType: "project" | "milestone" | "deliverable" | "integration" | "activity";
    title: string;
    status: string | null;
    source: IntegrationProvider | null;
    activityKind: string | null;
    occurredAt: IsoDateTime | null;
    dueAt: IsoDateTime | null;
    url: string | null;
};

export type AnalysisClaim = {
    text: string;
    evidenceIds: string[];
    evidence: AnalysisEvidence[];
};

/** Information for the project-health page, from GET /api/projects/{projectId}/dashboard. */
export type Dashboard = {
    project: Project;
    healthScore: number | null;
    overallHealth: HealthStatus;
    integrations: IntegrationStatus[];
    upcomingDeadlines: Milestone[];
    recentActivity: ActivityItem[];
    blockers: string[];
    nextSteps: string[];
    blockerDetails: AnalysisClaim[];
    nextStepDetails: AnalysisClaim[];
    analysisStatus: AnalysisStatus;
    latestSummary: Summary | null;
};

export type ExtractedMilestone = {
    title: string;
    date: string | null;
    deliverables: string[];
};

export type ExtractedPlan = {
    name: string;
    summary: string;
    features: string[];
    milestones: ExtractedMilestone[];
};

export type SpecImportResult = {
    filename: string;
    plan: ExtractedPlan;
    warnings: string[];
};