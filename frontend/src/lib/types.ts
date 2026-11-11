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

export type Project = {
    id: string;
    name: string;
    summary: string;
    features: string[];
    deliverables: Deliverable[];
    milestones: Milestone[];
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
    latestSummary: Summary | null;
}; 
