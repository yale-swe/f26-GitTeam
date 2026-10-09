import type { MilestoneStatus } from "@/lib/types";
import type { HealthStatus } from "@/lib/types";

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