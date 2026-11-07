"use client";

import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import PageHeader from "@/components/PageHeader/PageHeader";
import ProjectHealth from "@/components/ProjectHealth/ProjectHealth";
import { getDashboard, listProjects } from "@/lib/api";
import { useApiData } from "@/lib/useApiData";

// TODO: use the selected project once there is a project switcher
async function loadFirstDashboard() {
    const projects = await listProjects();
    return projects.length === 0 ? null : getDashboard(projects[0].id);
}

export default function HealthDashboardLoader() {
    const state = useApiData(loadFirstDashboard);

    if (state.status === "ready" && state.data) {
        return <ProjectHealth dashboard={state.data} />;
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