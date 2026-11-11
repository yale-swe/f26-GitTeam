"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import PageHeader from "@/components/PageHeader/PageHeader";
import ProjectHealth from "@/components/ProjectHealth/ProjectHealth";
import { generateProjectSummary, getDashboard, listProjects } from "@/lib/api";
import { getGitHubInstallUrl, syncGitHub } from "@/lib/github";
import type { Dashboard, Summary } from "@/lib/types";
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
    const [syncedDashboard, setSyncedDashboard] = useState<Dashboard | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [githubError, setGithubError] = useState<string | null>(null);

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

    async function handleSync() {
        if (state.status !== "ready" || !state.data || isSyncing) return;
        const projectId = state.data.project.id;

        setIsSyncing(true);
        setGithubError(null);
        try {
            await syncGitHub(projectId);
        } catch {
            setGithubError("GitHub sync failed. Its activity is hidden until a sync succeeds.");
        }
        // Reload either way: a failed sync marks GitHub as stale or failed.
        const refreshed = await getDashboard(projectId).catch(() => null);
        if (refreshed) setSyncedDashboard(refreshed);
        setIsSyncing(false);
    }

    async function handleConnectGitHub() {
        if (state.status !== "ready" || !state.data) return;

        setGithubError(null);
        try {
            const { url } = await getGitHubInstallUrl(state.data.project.id);
            window.location.assign(url);
        } catch {
            setGithubError("GitHub couldn't be connected. Please try again.");
        }
    }

    if (state.status === "ready" && state.data) {
        const current = syncedDashboard ?? state.data;
        const dashboard = generatedSummary ? { ...current, latestSummary: generatedSummary } : current;

        return (
            <ProjectHealth
                dashboard={dashboard}
                onGenerateSummary={handleGenerateSummary}
                isGenerating={isGenerating}
                summaryError={summaryError}
                onSync={handleSync}
                onConnectGitHub={handleConnectGitHub}
                isSyncing={isSyncing}
                githubError={githubError}
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
