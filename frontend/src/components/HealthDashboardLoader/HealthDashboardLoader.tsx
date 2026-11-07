"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import PageHeader from "@/components/PageHeader/PageHeader";
import ProjectHealth from "@/components/ProjectHealth/ProjectHealth";
import { getDashboard, listProjects } from "@/lib/api";
import type { Dashboard } from "@/lib/types";

type LoadState =
    | { status: "loading" }
    | { status: "error" }
    | { status: "empty" }
    | { status: "ready"; dashboard: Dashboard };

export default function HealthDashboardLoader() {
    const [state, setState] = useState<LoadState>({ status: "loading" });

    useEffect(() => {
        // Ignore results that arrive after the user has left the page
        let cancelled = false;

        async function load() {
            try {
                // TODO: use the selected project once there is a project switcher
                const projects = await listProjects();
                if (projects.length === 0) {
                    if (!cancelled) setState({ status: "empty" });
                    return;
                }
                const dashboard = await getDashboard(projects[0].id);
                if (!cancelled) setState({ status: "ready", dashboard });
            } catch {
                if (!cancelled) setState({ status: "error" });
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    if (state.status === "ready") {
        return <ProjectHealth dashboard={state.dashboard} />;
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
                {state.status === "empty" && (
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