import { describe, expect, test } from "vitest";

import { toPlanDraft } from "@/lib/specImport";
import type { ExtractedPlan } from "@/lib/types";

const plan: ExtractedPlan = {
    name: "Campus Cart",
    summary: "A campus marketplace.",
    features: ["Accounts", "Listings"],
    milestones: [
        { title: "Core", date: "2030-10-10", deliverables: ["Login", "Listing creation"] },
        { title: "Beta", date: null, deliverables: [] },
    ],
};

describe("toPlanDraft", () => {
    test("copies the name, summary, and features", () => {
        const draft = toPlanDraft(plan);
        expect(draft.name).toBe("Campus Cart");
        expect(draft.summary).toBe("A campus marketplace.");
        expect(draft.features.map((f) => f.title)).toEqual(["Accounts", "Listings"]);
    });

    test("links each deliverable to its milestone", () => {
        const draft = toPlanDraft(plan);
        const coreId = draft.milestones[0].id;
        expect(draft.deliverables.map((d) => d.title)).toEqual(["Login", "Listing creation"]);
        expect(draft.deliverables.every((d) => d.milestoneId === coreId)).toBe(true);
    });

    test("turns a missing date into an empty date field", () => {
        const draft = toPlanDraft(plan);
        expect(draft.milestones[0].date).toBe("2030-10-10");
        expect(draft.milestones[1].date).toBe("");
    });

    test("keeps one empty feature and milestone row when nothing was found", () => {
        const draft = toPlanDraft({ ...plan, features: [], milestones: [] });
        expect(draft.features).toHaveLength(1);
        expect(draft.milestones).toHaveLength(1);
        expect(draft.deliverables).toEqual([]);
    });
});