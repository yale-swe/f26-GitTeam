import type { Deliverable, DeliverableStatus, HealthStatus, IntegrationStatus, MilestoneStatus } from "@/lib/types";

const MS_PER_DAY = 1000 * 60 * 60 * 24
const MS_PER_MIN = 1000 * 60

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
    const minutes = Math.floor((Date.now() - new Date(isoDate).getTime()) / MS_PER_MIN);
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

export function milestoneStatusToText(status: MilestoneStatus) {
    if (status === "completed") return "Completed";
    if (status === "in_progress") return "In progress";
    if (status === "at_risk") return "Needs attention";
    return "Planned";
}

export function milestoneStatusToTone(status: MilestoneStatus) {
    if (status === "completed") return "green";
    if (status === "in_progress") return "blue";
    if (status === "at_risk") return "amber";
    return "gray";
}

export function deliverableStatusToText(status: DeliverableStatus) {
    if (status === "completed") return "Complete";
    if (status === "in_progress") return "In progress";
    if (status === "blocked") return "Blocked";
    return "Planned";
}

export function deliverableStatusToTone(status: DeliverableStatus) {
    if (status === "completed") return "green";
    if (status === "in_progress") return "blue";
    if (status === "blocked") return "amber";
    return "gray";
}

export function formatLongDate(isoDate: string) {
    return new Date(isoDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });
}

/** Days remaining as text for a milestone deadline, e.g. "10 days remaining". */
export function remainingText(isoDate: string) {
    const days = daysUntil(isoDate);
    if (days < 0) return `Overdue by ${plural(-days, "day")}`;
    if (days === 0) return "Due today";
    return `${plural(days, "day")} remaining`;
}

/** Completed-over-total progress for a set of deliverables; 0% when there are none. */
export function deliverableProgress(deliverables: Pick<Deliverable, "status">[]) {
    const total = deliverables.length;
    const completed = deliverables.filter((d) => d.status === "completed").length;
    return { completed, total, percent: total === 0 ? 0 : Math.round((completed * 100) / total) };
}
