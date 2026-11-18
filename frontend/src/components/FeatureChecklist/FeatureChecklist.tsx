"use client";

import { useState } from "react";

import { setFeatureCompleted } from "@/lib/api";
import styles from "./FeatureChecklist.module.css";

type FeatureChecklistProps = {
    projectId: string;
    features: string[];
    completedFeatures: string[];
};

export default function FeatureChecklist({ projectId, features, completedFeatures }: FeatureChecklistProps) {
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
                        <li key={feature}>
                            <label className={styles.item}>
                                <input
                                    type="checkbox"
                                    checked={isDone}
                                    onChange={(e) => toggle(feature, e.target.checked)}
                                />
                                <span className={isDone ? styles.done : undefined}>{feature}</span>
                            </label>
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