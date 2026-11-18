import {
    emptyDeliverable,
    emptyFeature,
    emptyMilestone,
    type DraftDeliverable,
    type DraftMilestone,
    type PlanDraft,
} from "@/lib/projectDraft";
import type { ExtractedPlan } from "@/lib/types";

/** Convert an imported spec plan into the onboarding form's draft shape. */
export function toPlanDraft(plan: ExtractedPlan): PlanDraft {
    const features = plan.features.map((title) => ({ ...emptyFeature(), title }));

    const milestones: DraftMilestone[] = [];
    const deliverables: DraftDeliverable[] = [];
    for (const m of plan.milestones) {
        const milestone = { ...emptyMilestone(), title: m.title, date: m.date ?? "" };
        milestones.push(milestone);
        for (const title of m.deliverables) {
            deliverables.push({ ...emptyDeliverable(milestone.id), title });
        }
    }

    return {
        name: plan.name,
        summary: plan.summary,
        features: features.length > 0 ? features : [emptyFeature()],
        milestones: milestones.length > 0 ? milestones : [emptyMilestone()],
        deliverables,
        discordChannels: [],
        connectGitHub: false,
    };
}