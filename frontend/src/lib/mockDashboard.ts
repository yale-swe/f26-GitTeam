// Fake dashboard data shaped exactly like the API response.
// Used to build and test the project-health page before the backend endpoint (GET /api/projects/{projectId}/dashboard) is ready.

import type { Dashboard } from "@/lib/types";

export const mockDashboard: Dashboard = {
    project: {
        id: "00000000-0000-0000-0000-000000000001",
        name: "Campus Cart",
        summary: "Marketplace for students to trade used textbooks and dorm essentials.",
        features: [
            "Listings and discovery",
            "Reservation and exchange",
            "Verified accounts",
            "Moderation and reports",
        ],
        deliverables: [
            "Campus email verification",
            "Listing image upload",
            "Reservation flow",
            "Seller notifications",
        ],
        milestones: [
            {
                id: "00000000-0000-0000-0000-000000000101",
                title: "Plan approved",
                dueAt: "2026-09-05T00:00:00Z",
                status: "completed",
            },
            {
                id: "00000000-0000-0000-0000-000000000102",
                title: "Core marketplace",
                dueAt: "2026-10-10T00:00:00Z",
                status: "completed",
            },
            {
                id: "00000000-0000-0000-0000-000000000103",
                title: "Beta checkout",
                dueAt: "2026-10-18T00:00:00Z",
                status: "at_risk",
            },
            {
                id: "00000000-0000-0000-0000-000000000104",
                title: "Final release",
                dueAt: "2026-10-31T00:00:00Z",
                status: "planned",
            },
        ],
    },
    overallHealth: "at_risk",
    integrations: [
        { provider: "github", status: "healthy", lastSuccessfulSyncAt: "2026-10-08T14:00:00Z" },
        { provider: "discord", status: "stale", lastSuccessfulSyncAt: "2026-10-05T09:30:00Z" },
    ],
    upcomingDeadlines: [
        {
            id: "00000000-0000-0000-0000-000000000103",
            title: "Beta checkout",
            dueAt: "2026-10-18T00:00:00Z",
            status: "at_risk",
        },
        {
            id: "00000000-0000-0000-0000-000000000104",
            title: "Final release",
            dueAt: "2026-10-31T00:00:00Z",
            status: "planned",
        },
    ],
    recentActivity: [
        {
            id: "gh-pr-48",
            source: "github",
            kind: "pull_request",
            occurredAt: "2026-10-08T11:00:00Z",
            title: "feat: add listing image upload and preview",
        },
        {
            id: "gh-pr-46",
            source: "github",
            kind: "pull_request",
            occurredAt: "2026-10-07T16:20:00Z",
            title: "fix: validate campus email domain",
        },
        {
            id: "dc-msg-9001",
            source: "discord",
            kind: "message",
            occurredAt: "2026-10-07T13:05:00Z",
            title: "Free image-storage quota may be too small",
        },
    ],
    blockers: [
        "Free image-storage quota may be too small",
        "Reservation expiry behavior is unresolved",
    ],
    nextSteps: [
        "Assign a decision owner for reservation expiry",
        "Choose image storage by tomorrow",
        "Review PR #48 before the next team sync",
    ],
    latestSummary: {
        id: "00000000-0000-0000-0000-000000000201",
        projectId: "00000000-0000-0000-0000-000000000001",
        text: "Campus Cart is making steady progress toward the Oct 18 beta, but checkout is now the critical path.",
        generatedAt: "2026-10-08T14:05:00Z",
    },
};