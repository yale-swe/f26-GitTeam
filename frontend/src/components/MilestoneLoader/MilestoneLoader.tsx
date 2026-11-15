"use client";

import { useCallback, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import MilestoneDetail from "@/components/MilestoneDetail/MilestoneDetail";
import PageHeader from "@/components/PageHeader/PageHeader";
import {
  addDeliverable,
  getMilestone,
  listProjects,
  updateDeliverable,
  updateMilestone,
} from "@/lib/api";
import { deliverableProgress } from "@/lib/dashboardFormat";
import type { Deliverable, MilestoneDetail as MilestoneDetailData, MilestoneUpdate } from "@/lib/types";
import { useApiData } from "@/lib/useApiData";

type Loaded = { projectId: string; projectName: string; detail: MilestoneDetailData | null };

/** Progress recalculated locally so a toggle shows instantly, before the save returns. */
function withDeliverables(detail: MilestoneDetailData, deliverables: Deliverable[]): MilestoneDetailData {
  return { ...detail, deliverables, progress: deliverableProgress(deliverables) };
}

export default function MilestoneLoader() {
  // The milestone comes from the route; `?project=` picks the project (default: the first).
  const requestedProjectId = useSearchParams()?.get("project") ?? null;
  const milestoneId = String(useParams()?.milestoneId ?? "");

  const load = useCallback(async (): Promise<Loaded | null> => {
    const projects = await listProjects();
    if (projects.length === 0) return null;
    const project =
      (requestedProjectId && projects.find((p) => p.id === requestedProjectId)) || projects[0];
    const base = { projectId: project.id, projectName: project.name };
    if (!project.milestones.some((m) => m.id === milestoneId)) return { ...base, detail: null };
    return { ...base, detail: await getMilestone(project.id, milestoneId) };
  }, [requestedProjectId, milestoneId]);

  const state = useApiData(load);
  const [override, setOverride] = useState<MilestoneDetailData | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (state.status === "ready" && state.data?.detail) {
    const loaded = state.data;
    const detail = override?.id === loaded.detail?.id ? override : loaded.detail;
    if (!detail) return null;

    async function toggleDeliverable(item: Deliverable) {
      const next = item.status === "completed" ? "in_progress" : "completed";
      const previous = detail as MilestoneDetailData;
      setSaveError(null);
      setOverride(
        withDeliverables(
          previous,
          previous.deliverables.map((d) => (d.id === item.id ? { ...d, status: next } : d)),
        ),
      );
      try {
        await updateDeliverable(previous.projectId, item.id, { status: next });
      } catch {
        setOverride(previous);
        setSaveError("That change could not be saved. Please try again.");
      }
    }

    async function addNewDeliverable(title: string) {
      const current = detail as MilestoneDetailData;
      const created = await addDeliverable(current.projectId, current.id, title);
      setOverride(withDeliverables(current, [...current.deliverables, created]));
    }

    async function saveMilestone(changes: MilestoneUpdate) {
      const current = detail as MilestoneDetailData;
      setOverride(await updateMilestone(current.projectId, current.id, changes));
    }

    return (
      <MilestoneDetail
        detail={detail}
        projectName={loaded.projectName}
        backHref={`/milestones?project=${loaded.projectId}`}
        errorMessage={saveError}
        onToggleDeliverable={toggleDeliverable}
        onAddDeliverable={addNewDeliverable}
        onSaveMilestone={saveMilestone}
      />
    );
  }

  return (
    <AppShell activeNav="milestones">
      <PageHeader title="Milestone" description="Deliverables, progress, and deadline for one milestone." />
      <Card>
        {state.status === "loading" && <p>Loading milestone…</p>}
        {state.status === "error" && <p>The milestone couldn&apos;t be loaded. Try refreshing the page.</p>}
        {state.status === "ready" && !state.data && (
          <>
            <p>You don&apos;t have any projects yet.</p>
            <Button variant="primary" href="/projects/new">
              Create a project
            </Button>
          </>
        )}
        {state.status === "ready" && state.data && !state.data.detail && (
          <>
            <p>Milestone not found.</p>
            <Button href={`/milestones?project=${state.data.projectId}`}>Back to milestones</Button>
          </>
        )}
      </Card>
    </AppShell>
  );
}
