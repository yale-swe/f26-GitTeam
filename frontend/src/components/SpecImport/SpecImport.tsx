"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import PageHeader from "@/components/PageHeader/PageHeader";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import { importSpec } from "@/lib/api";
import { draftHasContent } from "@/lib/projectDraft";
import { toPlanDraft } from "@/lib/specImport";
import type { SpecImportResult } from "@/lib/types";
import { useProjectDraft } from "@/lib/useProjectDraft";
import styles from "./SpecImport.module.css";
import StatusPill from "@/components/StatusPill/StatusPill";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = [".pdf", ".docx", ".md", ".txt"];

/** Turn an apiFetch error ("API 415: ...") into a message for the user. */
function errorMessage(error: unknown): string {
    const status = Number(/API (\d+)/.exec(String(error))?.[1]);
    if (status === 413) return "The file is too large. The limit is 10 MB.";
    if (status === 415) return "Upload a PDF, DOCX, Markdown, or text file.";
    if (status === 422) return "No readable text was found in this file.";
    if (status === 502 || status === 503) {
        return "The plan couldn't be extracted right now. Please try again.";
    }
    return "Something went wrong while importing. Please try again.";
}

export default function SpecImport() {
    const router = useRouter();
    const { draft, setDraft } = useProjectDraft();
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<"idle" | "uploading" | "done">("idle");
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<SpecImportResult | null>(null);

    function chooseFile(next: File | null) {
        setFile(next);
        setError(null);
        setResult(null);
        setStatus("idle");
    }

    async function handleImport() {
        if (!file) return;
        // Check locally first so we don't upload something the backend will reject.
        if (!ACCEPTED.some((ext) => file.name.toLowerCase().endsWith(ext))) {
            setError("Upload a PDF, DOCX, Markdown, or text file.");
            return;
        }
        if (file.size > MAX_BYTES) {
            setError("The file is too large. The limit is 10 MB.");
            return;
        }

        setStatus("uploading");
        setError(null);
        try {
            setResult(await importSpec(file));
            setStatus("done");
        } catch (err) {
            setError(errorMessage(err));
            setStatus("idle");
        }
    }

    function usePlan() {
        if (!result) return;
        if (
            draftHasContent(draft) &&
            !window.confirm("Replace your current draft with the imported plan?")
        ) {
            return;
        }
        setDraft(toPlanDraft(result.plan));
        router.push("/projects/new");
    }

    const plan = result?.plan;
    const deliverableCount = plan?.milestones.reduce((n, m) => n + m.deliverables.length, 0) ?? 0;
    const needsReview = (name: string) => result?.warnings.some((w) => w.includes(`'${name}'`)) ?? false;
    const warningCount = result?.warnings.length ?? 0;
    const reviewStatus =
        warningCount === 0 ? "Looks complete" : `${warningCount} ${warningCount === 1 ? "item" : "items"} to review`;

    return (
        <AppShell activeNav="projects" showProjectContext={false}>
            <PageHeader
                eyebrow="New project"
                title="Import a specification"
                description="Upload a proposal, requirements document, or README. DevSync extracts a draft plan for you to review."
                showBack
                backHref="/projects/new"
            />

            <Card>
                <SectionHeader title="Choose a file" description="PDF, DOCX, Markdown, or text · up to 10 MB" />
                <label className={styles.fileLabel}>
                    Specification file
                    <input
                        type="file"
                        accept={ACCEPTED.join(",")}
                        aria-label="Specification file"
                        className={styles.fileInput}
                        onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
                        disabled={status === "uploading"}
                    />
                </label>
                <div className={styles.actions}>
                    <Button
                        variant="primary"
                        onClick={handleImport}
                        disabled={!file || status === "uploading"}
                    >
                        {status === "uploading" ? "Reading your specification…" : "Import"}
                    </Button>
                </div>
                {error && (
                    <p className={styles.error} role="alert">
                        {error}
                    </p>
                )}
            </Card>

            {plan && result && (
                <Card>
                    <SectionHeader title={`Found in ${result.filename}`} />
                    <p className={styles.summary}>
                        {file?.name} · {file ? Math.ceil(file.size / 1024) : 0} KB · {reviewStatus}
                    </p>
                    <p className={styles.summary}>
                        {plan.name || "Untitled project"} · {plan.features.length} features ·{" "}
                        {plan.milestones.length} milestones · {deliverableCount} deliverables
                    </p>

                    <p className={styles.warningTitle}>Features</p>
                    <ul className={styles.items}>
                        {plan.features.map((f) => (
                            <li key={f}>
                                {f} {needsReview(f) && <StatusPill tone="gray">Needs review</StatusPill>}
                            </li>
                        ))}
                    </ul>

                    <p className={styles.warningTitle}>Milestones</p>
                    <ul className={styles.items}>
                        {plan.milestones.map((m) => (
                            <li key={m.title}>
                                {m.title} · {m.date ?? "No date"}{" "}
                                {needsReview(m.title) && <StatusPill tone="gray">Needs review</StatusPill>}
                                {m.deliverables.length > 0 && (
                                    <ul className={styles.items}>
                                        {m.deliverables.map((d) => (
                                            <li key={d}>
                                                {d} {needsReview(d) && <StatusPill tone="gray">Needs review</StatusPill>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ul>

                    {result.warnings.length > 0 && (
                        <>
                            <p className={styles.warningTitle}>Review before continuing:</p>
                            <ul className={styles.warnings}>
                                {result.warnings.map((w) => (
                                    <li key={w}>{w}</li>
                                ))}
                            </ul>
                        </>
                    )}

                    <div className={styles.actions}>
                        <Button variant="primary" onClick={usePlan}>
                            Use this plan
                        </Button>
                        <Button onClick={() => chooseFile(null)}>Choose another file</Button>
                    </div>
                </Card>
            )}
        </AppShell>
    );
}