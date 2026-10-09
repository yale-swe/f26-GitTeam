import type { MilestoneStatus } from "@/lib/types";

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