import type {
    HealthStatus,
    IntegrationProvider,
    IntegrationStatus,
    MilestoneStatus,
} from "@/lib/types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_MIN = 1000 * 60;
const EXECUTIVE_SECTIONS = ["Recent progress", "Upcoming milestones", "Notable activity"] as const;
const ISO_DATE_TIME =
    /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})\b/g;
type ExecutiveSection = (typeof EXECUTIVE_SECTIONS)[number];
const INTEGRATION_PROVIDERS: IntegrationProvider[] = ["github", "discord"];
const INTEGRATION_LABELS: Record<IntegrationProvider, string> = {
    github: "GitHub",
    discord: "Discord",
};

function cleanSummaryText(text: string) {
    return text
        .replace(/\s*\[Evidence:[^\]]+\]/gi, "")
        .replace(ISO_DATE_TIME, formatInlineDate)
        .replace(/\s+/g, " ")
        .trim();
}

function formatInlineDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });
}

/**
 * Turn the stored, evidence-rich report into the short paragraph used by the
 * executive-summary card. Blockers and next steps have dedicated evidence
 * cards, so repeating those sections here makes the dashboard harder to scan.
 */
export function formatExecutiveSummary(text: string) {
    const claims: Record<ExecutiveSection, string[]> = {
        "Recent progress": [],
        "Upcoming milestones": [],
        "Notable activity": [],
    };
    let currentSection: ExecutiveSection | null = null;
    let structuredReport = false;

    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        const section = EXECUTIVE_SECTIONS.find((title) => line === `${title}:`);
        if (section) {
            currentSection = section;
            structuredReport = true;
            continue;
        }
        if (/^(Blockers|Next steps|Limitations):$/.test(line)) {
            currentSection = null;
            structuredReport = true;
            continue;
        }
        if (!currentSection || !line.startsWith("- ")) continue;

        const claim = cleanSummaryText(line.slice(2));
        if (claim && !/^No supported information available\.?$/i.test(claim)) {
            claims[currentSection].push(claim);
        }
    }

    if (!structuredReport) return cleanSummaryText(text);

    const summary = EXECUTIVE_SECTIONS.flatMap((section) => claims[section].slice(0, 1));
    return summary.join(" ") || "No supported progress or recent activity is available yet.";
}

/** Describe source-data limitations without requiring another LLM response. */
export function integrationLimitations(integrations: IntegrationStatus[]) {
    const byProvider = new Map(integrations.map((integration) => [integration.provider, integration]));

    return INTEGRATION_PROVIDERS.flatMap((provider) => {
        const integration = byProvider.get(provider);
        const label = INTEGRATION_LABELS[provider];
        if (!integration) return [`${label} is not connected.`];
        if (integration.status === "healthy") return [];

        const lastSync = integration.lastSuccessfulSyncAt
            ? ` Last successful sync was ${timeAgo(integration.lastSuccessfulSyncAt)}.`
            : "";

        if (integration.status === "connected") {
            return [`${label} is connected but has not completed a successful sync.`];
        }
        if (integration.status === "syncing") {
            return [`${label} synchronization is in progress; its activity may not be current yet.`];
        }
        if (integration.status === "stale") {
            return [`${label} data is stale.${lastSync}`];
        }
        return [`${label} synchronization failed.${lastSync}`];
    });
}

export function toTimelineState(status: MilestoneStatus) {
    if (status === "completed") return "done";
    if (status === "at_risk") return "current";
    if (status === "in_progress") return "current";
    return "upcoming";
}

export function formatShortDate(isoDate: string) {
    return new Date(isoDate).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        timeZone: "UTC",
    });
}

export function healthToText(status: HealthStatus) {
    if (status === "healthy") return "On track";
    if (status === "at_risk") return "Needs attention";
    if (status === "blocked") return "Blocked";
    return "Unclear";
}

export function statusToColor(status: HealthStatus) {
    if (status === "healthy") return "green";
    if (status === "at_risk") return "amber";
    if (status === "blocked") return "red";
    return "gray";
}

export function daysUntil(isoDate: string) {
    const timeDiff = new Date(isoDate).getTime() - Date.now();
    return Math.ceil(timeDiff / MS_PER_DAY);
}

export function timeAgo(isoDate: string) {
    const timestamp = new Date(isoDate).getTime();
    if (Number.isNaN(timestamp)) return "at an unknown time";

    // A generated timestamp can be a few seconds ahead when the browser and API
    // clocks differ. Treat that as current instead of showing a negative age.
    const minutes = Math.floor(Math.max(0, Date.now() - timestamp) / MS_PER_MIN);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${plural(minutes, "minute")} ago`;
    if (minutes < 60 * 24) return `${plural(Math.floor(minutes / 60), "hour")} ago`;
    return `${plural(Math.floor(minutes / (60 * 24)), "day")} ago`;
}

export function plural(count: number, word: string) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function dueText(isoDate: string) {
    const days = daysUntil(isoDate);
    if (days < 0) return `Overdue by ${plural(-days, "day")}`;
    if (days === 0) return "Due today";
    return `due in ${plural(days, "day")}`;
}

export function syncStatusToDot(status: IntegrationStatus["status"]) {
    if (status === "healthy" || status === "connected") return "dot-6-green";
    if (status === "failed") return "dot-6-red";
    return "dot-6-amber";
}
