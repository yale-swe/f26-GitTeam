"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import PageHeader from "@/components/PageHeader/PageHeader";
import ProjectHealth from "@/components/ProjectHealth/ProjectHealth";
import { generateProjectSummary, getDashboard, listProjects } from "@/lib/api";
import type { Summary } from "@/lib/types";
import { useApiData } from "@/lib/useApiData";

// TODO: use the selected project once there is a project switcher
async function loadFirstDashboard() {
    const projects = await listProjects();
    return projects.length === 0 ? null : getDashboard(projects[0].id);
}

export default function HealthDashboardLoader() {
    const state = useApiData(loadFirstDashboard);
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
