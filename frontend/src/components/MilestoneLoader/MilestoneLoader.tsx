"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import type { Deliverable, MilestoneDetail as MilestoneDetailData, MilestoneUpdate } from "@/lib/types";
import { useApiData } from "@/lib/useApiData";

type Loaded = { projectName: string; detail: MilestoneDetailData } | { projectName: string; detail: null };

/** Progress recalculated locally so a toggle shows instantly, before the save returns. */
function withDeliverables(detail: MilestoneDetailData, deliverables: Deliverable[]): MilestoneDetailData {
  const completed = deliverables.filter((d) => d.status === "completed").length;
  const total = deliverables.length;
  return {
    ...detail,
    deliverables,
    progress: { completed, total, percent: total ? Math.round((completed * 100) / total) : 0 },
  };
}

export default function MilestoneLoader() {
  // `?project=` and `?milestone=` pick what to show; otherwise the first project's
  // earliest unfinished milestone.
  const params = useSearchParams();
  const requestedProjectId = params?.get("project") ?? null;
  const requestedMilestoneId = params?.get("milestone") ?? null;

  const load = useCallback(async (): Promise<Loaded | null> => {
    const projects = await listProjects();
    if (projects.length === 0) return null;
    const project =
      (requestedProjectId && projects.find((p) => p.id === requestedProjectId)) || projects[0];
    const milestones = project.milestones;
    const milestone =
      milestones.find((m) => m.id === requestedMilestoneId) ??
      milestones.find((m) => m.status !== "completed") ??
      milestones[milestones.length - 1];
    if (!milestone) return { projectName: project.name, detail: null };
    return { projectName: project.name, detail: await getMilestone(project.id, milestone.id) };
  }, [requestedProjectId, requestedMilestoneId]);

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
          <p>This project doesn&apos;t have any milestones yet.</p>
        )}
      </Card>
    </AppShell>
  );
}
