// Types for data returned by the DevSync API.
// These match the OpenAPI schemas in PROJECT_SPEC.md, section 10.4.
// If the spec changes, update these types to match.

/** Dates arrive from the API as ISO 8601 text, e.g. "2026-10-18T00:00:00Z". */
export type MilestoneStatus = "planned" | "in_progress" | "completed" | "at_risk";

export type Milestone = {
    id: string;
    title: string;
    dueAt: string;
    status: MilestoneStatus;
};

export type Project = {
    id: string;
    name: string;
    summary: string;
    features: string[];
    deliverables: string[];
    milestones: Milestone[];
};

export type IntegrationProvider = "github" | "discord";

export type IntegrationStatus = {
    provider: IntegrationProvider;
    status: "connected" | "syncing" | "healthy" | "stale" | "failed";
    lastSuccessfulSyncAt?: string | null;
};

export type ActivityItem = {
    id: string;
    source: IntegrationProvider;
    kind: string;
    occurredAt: string;
    title: string;
};

export type Summary = {
    id: string;
    projectId: string;
    text: string;
    generatedAt: string;
};

/** Overall project health. */
export type HealthStatus = "healthy" | "at_risk" | "blocked" | "unknown";

/** Result returned by POST /api/health/score. */
export type HealthScore = {
    score: number | null;
    status: HealthStatus;
};

/** Information for the project-health page, from GET /api/projects/{projectId}/dashboard. */
export type Dashboard = {
    project: Project;
    overallHealth: HealthStatus;
    integrations: IntegrationStatus[];
    upcomingDeadlines: Milestone[];
    recentActivity: ActivityItem[];
    blockers: string[];
    nextSteps: string[];
    latestSummary: Summary | null;
}; 
