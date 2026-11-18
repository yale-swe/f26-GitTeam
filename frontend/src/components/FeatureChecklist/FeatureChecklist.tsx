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
    const [error, setError] = useState<string | null>(null);

    async function toggle(feature: string, completed: boolean) {
        const previous = done;
        setDone(completed ? [...done, feature] : done.filter((f) => f !== feature));
        setError(null);
        try {
            const project = await setFeatureCompleted(projectId, feature, completed);
            setDone(project.completedFeatures);
        } catch {
            setDone(previous);
            setError("Couldn't save that change. Please try again.");
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