import type { MilestoneStatus } from "@/lib/types";
import type { HealthStatus } from "@/lib/types";

const MS_PER_DAY = 1000 * 60 * 60 * 24

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