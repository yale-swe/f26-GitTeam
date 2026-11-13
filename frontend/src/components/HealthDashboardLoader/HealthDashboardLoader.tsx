"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import PageHeader from "@/components/PageHeader/PageHeader";
import ProjectHealth from "@/components/ProjectHealth/ProjectHealth";
import { generateProjectSummary, getDashboard, listProjects } from "@/lib/api";
import type { Summary } from "@/lib/types";
import { useApiData } from "@/lib/useApiData";

export default function HealthDashboardLoader() {
    // Prefer the project passed via `?project=` (e.g. just after creating one);
    // otherwise fall back to the first project the user belongs to.
    const requestedProjectId = useSearchParams()?.get("project") ?? null;
    const loadDashboard = useCallback(async () => {
        const projects = await listProjects();
        if (projects.length === 0) return null;
        const selected =
            (requestedProjectId && projects.find((p) => p.id === requestedProjectId)) ||
            projects[0];
        return getDashboard(selected.id);
    }, [requestedProjectId]);
    const state = useApiData(loadDashboard);
    const [generatedSummary, setGeneratedSummary] = useState<Summary | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);

    async function handleGenerateSummary() {
        if (state.status !== "ready" || !state.data || isGenerating) return;

        setIsGenerating(true);
        setSummaryError(null);

        try {
            const summary = await generateProjectSummary(state.data.project.id);
            setGeneratedSummary(summary);
        } catch {
            setSummaryError("The summary could not be generated. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    }

    if (state.status === "ready" && state.data) {
        const dashboard = generatedSummary
            ? { ...state.data, latestSummary: generatedSummary }
            : state.data;

        return (
            <ProjectHealth
                dashboard={dashboard}
                onGenerateSummary={handleGenerateSummary}
                isGenerating={isGenerating}
                summaryError={summaryError}
            />
        );
    }

    return (
        <AppShell activeNav="health">
            <PageHeader
                title="Project health"
                description="Where the project stands based on the plan, GitHub work, and Discord context."
            />
            <Card>
                {state.status === "loading" && <p>Loading project health…</p>}
                {state.status === "error" && <p>Project health couldn&apos;t be loaded. Try refreshing the page.</p>}
                {state.status === "ready" && !state.data && (
                    <>
                        <p>You don&apos;t have any projects yet.</p>
                        <Button variant="primary" href="/projects/new">
                            Create a project
                        </Button>
                    </>
                )}
            </Card>
        </AppShell>
    );
}
