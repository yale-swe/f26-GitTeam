"use client";

import { useMemo, useState } from "react";

import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import PageHeader from "@/components/PageHeader/PageHeader";
import SetupStepper from "@/components/SetupStepper/SetupStepper";
import {
  emptyDeliverable,
  emptyFeature,
  emptyMilestone,
  exampleCampusCartDraft,
  moveDeliverable,
  planQualityChecks,
  removeMilestoneFromDraft,
  validatePlan,
  type DraftDeliverable,
  type DraftFeature,
  type DraftMilestone,
} from "@/lib/projectDraft";
import { useProjectDraft } from "@/lib/useProjectDraft";

import ContinueCard from "./ContinueCard";
import DraftStatusCard from "./DraftStatusCard";
import FeaturesCard from "./FeaturesCard";
import HowItWorksCard from "./HowItWorksCard";
import ImportCard from "./ImportCard";
import MilestonesCard from "./MilestonesCard";
import PlanQualityCard from "./PlanQualityCard";
import SummaryCard from "./SummaryCard";
import WarningsCard from "./WarningsCard";
import styles from "./CreateProject.module.css";

export default function CreateProject() {
  const {
    draft,
    setDraft,
    updateDraft,
    lastSavedAt,
    hasSavedDraft,
    resumedFromDraft,
    saveDraft,
    discardDraft,
  } = useProjectDraft();
  const [showErrors, setShowErrors] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  const validation = useMemo(() => validatePlan(draft), [draft]);
  const qualityChecks = useMemo(() => planQualityChecks(draft), [draft]);

  // Features.
  const addFeature = () => {
    const feature = emptyFeature();
    setFocusId(feature.id);
    updateDraft({ features: [...draft.features, feature] });
  };
  const updateFeature = (id: string, patch: Partial<DraftFeature>) =>
    updateDraft({ features: draft.features.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  const removeFeature = (id: string) =>
    updateDraft({ features: draft.features.filter((f) => f.id !== id) });

  // Milestones.
  const addMilestone = () => {
    const milestone = emptyMilestone();
    setFocusId(milestone.id);
    updateDraft({ milestones: [...draft.milestones, milestone] });
  };
  const updateMilestone = (id: string, patch: Partial<DraftMilestone>) =>
    updateDraft({
      milestones: draft.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  const removeMilestone = (id: string) => {
    const linked = draft.deliverables.filter((d) => d.milestoneId === id).length;
    if (linked > 0) {
      const ok = window.confirm(
        `Remove this milestone and its ${linked} deliverable${linked === 1 ? "" : "s"}? Move deliverables to another milestone first if you want to keep them.`,
      );
      if (!ok) return;
    }
    updateDraft(removeMilestoneFromDraft(draft, id));
  };

  // Deliverables (always nested under a milestone).
  const addDeliverable = (milestoneId: string) => {
    const deliverable = emptyDeliverable(milestoneId);
    setFocusId(deliverable.id);
    updateDraft({ deliverables: [...draft.deliverables, deliverable] });
  };
  const updateDeliverable = (id: string, patch: Partial<DraftDeliverable>) =>
    updateDraft({
      deliverables: draft.deliverables.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    });
  const removeDeliverable = (id: string) =>
    updateDraft({ deliverables: draft.deliverables.filter((d) => d.id !== id) });

  const moveDeliverableTo = (id: string, targetMilestoneId: string, index?: number) =>
    updateDraft({
      deliverables: moveDeliverable(draft, id, targetMilestoneId, index).deliverables,
    });

  const handleSaveDraft = () => {
    setShowErrors(validation.errors.length > 0);
    saveDraft();
  };

  const draftHasContent =
    hasSavedDraft ||
    draft.name.trim().length > 0 ||
    draft.features.some((f) => f.title.trim()) ||
    draft.milestones.some((m) => m.title.trim());

  const handleFillExample = () => {
    if (
      draftHasContent &&
      !window.confirm("Replace your current draft with the example Campus Cart plan?")
    ) {
      return;
    }
    setDraft(exampleCampusCartDraft());
  };

  return (
    <AppShell activeNav="projects" showProjectContext={false}>
      <PageHeader
        eyebrow="New project"
        title="Create your project plan"
        description="Turn a clear project brief into milestones your team can coordinate around."
        showBack
        actions={<Button onClick={handleSaveDraft}>Save draft</Button>}
      />

      <SetupStepper current={2} />

      <div className={styles.workspace}>
        <div className={styles.mainColumn}>
          <SummaryCard draft={draft} onChange={updateDraft} showErrors={showErrors} />
          <FeaturesCard
            features={draft.features}
            onAdd={addFeature}
            onUpdate={updateFeature}
            onRemove={removeFeature}
            focusId={focusId}
          />
          <MilestonesCard
            milestones={draft.milestones}
            deliverables={draft.deliverables}
            onAdd={addMilestone}
            onUpdate={updateMilestone}
            onRemove={removeMilestone}
            onAddDeliverable={addDeliverable}
            onUpdateDeliverable={updateDeliverable}
            onRemoveDeliverable={removeDeliverable}
            onMoveDeliverable={moveDeliverableTo}
            focusId={focusId}
          />
        </div>

        <div className={styles.sideColumn}>
          <ImportCard />
          <WarningsCard validation={validation} />
          <PlanQualityCard checks={qualityChecks} />
          <ContinueCard errorCount={validation.errors.length} onSaveDraft={handleSaveDraft} />
          <DraftStatusCard
            lastSavedAt={lastSavedAt}
            hasSavedDraft={hasSavedDraft}
            resumed={resumedFromDraft}
            onDiscard={discardDraft}
            onFillExample={handleFillExample}
          />
          <HowItWorksCard />
        </div>
      </div>
    </AppShell>
  );
}
