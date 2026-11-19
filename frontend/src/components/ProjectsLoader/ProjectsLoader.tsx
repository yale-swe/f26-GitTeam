"use client";

import AppShell from "@/components/AppShell/AppShell";
import Card from "@/components/Card/Card";
import PageHeader from "@/components/PageHeader/PageHeader";
import ProjectsOverview from "@/components/ProjectsOverview/ProjectsOverview";
import { getDashboard, listProjects } from "@/lib/api";
import { useApiData } from "@/lib/useApiData";

async function loadAllDashboards() {
    const projects = await listProjects();
    // Fetch every project's dashboard at the same time
    return Promise.all(projects.map((project) => getDashboard(project.id)));
}

export default function ProjectsLoader() {
    const state = useApiData(loadAllDashboards);

    if (state.status === "ready") {
        return <ProjectsOverview dashboards={state.data} />;
    }

    return (
        <AppShell activeNav="projects">
            <PageHeader
                title="Projects"
                description="Monitor delivery health, deadlines, and team activity across your workspace."
            />
            <Card>
                {state.status === "loading" && <p>Loading projects…</p>}
                {state.status === "error" && <p>Projects couldn&apos;t be loaded. Try refreshing the page.</p>}
            </Card>
        </AppShell>
    );
}