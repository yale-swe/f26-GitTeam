"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import MilestonesList from "@/components/MilestonesList/MilestonesList";
import PageHeader from "@/components/PageHeader/PageHeader";
import { listProjects } from "@/lib/api";
import { useApiData } from "@/lib/useApiData";

export default function MilestonesLoader() {
  // `?project=` picks the project; otherwise the first one the user belongs to.
  const requestedProjectId = useSearchParams()?.get("project") ?? null;
  const load = useCallback(async () => {
    const projects = await listProjects();
    if (projects.length === 0) return null;
    return (requestedProjectId && projects.find((p) => p.id === requestedProjectId)) || projects[0];
  }, [requestedProjectId]);
  const state = useApiData(load);

  if (state.status === "ready" && state.data) {
    return <MilestonesList project={state.data} />;
  }

  return (
    <AppShell activeNav="milestones">
      <PageHeader title="Milestones" description="Every milestone in the project plan." />
      <Card>
        {state.status === "loading" && <p>Loading milestones…</p>}
        {state.status === "error" && <p>Milestones couldn&apos;t be loaded. Try refreshing the page.</p>}
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
