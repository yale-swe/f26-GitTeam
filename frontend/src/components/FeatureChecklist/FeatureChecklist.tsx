"use client";

import { useState } from "react";
import type { FeatureSuggestion } from "@/lib/types";
import { setFeatureCompleted } from "@/lib/api";
import styles from "./FeatureChecklist.module.css";

type FeatureChecklistProps = {
    projectId: string;
    features: string[];
    completedFeatures: string[];
    suggestions?: FeatureSuggestion[];
};


export default function FeatureChecklist({
    projectId,
    features,
    completedFeatures,
    suggestions = [],
}: FeatureChecklistProps) {
    const [done, setDone] = useState<string[]>(completedFeatures);
    const [saving, setSaving] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    async function toggle(feature: string, completed: boolean) {
        // Ignore clicks while this feature is still saving, so responses can't arrive out of order.
        if (saving.includes(feature)) return;

        const apply = (list: string[], on: boolean) =>
            on ? [...list.filter((f) => f !== feature), feature] : list.filter((f) => f !== feature);

        setSaving((current) => [...current, feature]);
        setDone((current) => apply(current, completed));
        setError(null);
        try {
            await setFeatureCompleted(projectId, feature, completed);
        } catch {
            // Undo only this feature, leaving any other in-flight changes alone.
            setDone((current) => apply(current, !completed));
            setError("Couldn't save that change. Please try again.");
        } finally {
            setSaving((current) => current.filter((f) => f !== feature));
        }
    }

    if (features.length === 0) {
        return <p className={styles.empty}>No features in the project plan yet.</p>;
    }

    return (
        <>
            <p className={styles.count}>
                {done.length} of {features.length} done
            </p>
            <ul className={styles.list}>
                {features.map((feature) => {
                    const isDone = done.includes(feature);
                    return (
                        <li key={feature} className={styles.row}>
                            <label className={styles.item}>
                                <input
                                    type="checkbox"
                                    checked={isDone}
                                    disabled={saving.includes(feature)}
                                    onChange={(e) => toggle(feature, e.target.checked)}
                                />
                                <span className={isDone ? styles.done : undefined}>{feature}</span>
                            </label>
                            {!isDone && <FeatureHint suggestion={suggestions.find((s) => s.feature === feature)} onMarkDone={() => toggle(feature, true)} />}
                        </li>
                    );
                })}
            </ul>
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
        </>
    );
}

function FeatureHint({
    suggestion,
    onMarkDone,
}: {
    suggestion: FeatureSuggestion | undefined;
    onMarkDone: () => void;
}) {
    if (!suggestion) {
        return <p className={styles.hint}>No activity yet</p>;
    }
    if (suggestion.status === "in_progress") {
        return <p className={styles.hint}>In progress: {suggestion.text}</p>;
    }
    return (
        <p className={styles.hint}>
            Looks done: {suggestion.text}{" "}
            <button type="button" className={styles.markDone} onClick={onMarkDone}>
                Mark done
            </button>
        </p>
    );
}