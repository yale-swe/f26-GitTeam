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
  planQualityChecks,
  validatePlan,
  type DraftDeliverable,
  type DraftFeature,
  type DraftMilestone,
} from "@/lib/projectDraft";
import { useProjectDraft } from "@/lib/useProjectDraft";

import ContinueCard from "./ContinueCard";
import DeliverablesCard from "./DeliverablesCard";
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
  const { draft, updateDraft, lastSavedAt, hasSavedDraft, saveDraft, discardDraft } =
    useProjectDraft();
  const [showErrors, setShowErrors] = useState(false);

  const validation = useMemo(() => validatePlan(draft), [draft]);
  const qualityChecks = useMemo(() => planQualityChecks(draft), [draft]);

  // Features.
  const addFeature = () => updateDraft({ features: [...draft.features, emptyFeature()] });
  const updateFeature = (id: string, patch: Partial<DraftFeature>) =>
    updateDraft({ features: draft.features.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  const removeFeature = (id: string) =>
    updateDraft({ features: draft.features.filter((f) => f.id !== id) });

  // Milestones.
  const addMilestone = () => updateDraft({ milestones: [...draft.milestones, emptyMilestone()] });
  const updateMilestone = (id: string, patch: Partial<DraftMilestone>) =>
    updateDraft({
      milestones: draft.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  const removeMilestone = (id: string) =>
    updateDraft({ milestones: draft.milestones.filter((m) => m.id !== id) });

  // Deliverables.
  const addDeliverable = () =>
    updateDraft({ deliverables: [...draft.deliverables, emptyDeliverable()] });
  const updateDeliverable = (id: string, patch: Partial<DraftDeliverable>) =>
    updateDraft({
      deliverables: draft.deliverables.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    });
  const removeDeliverable = (id: string) =>
    updateDraft({ deliverables: draft.deliverables.filter((d) => d.id !== id) });

  const handleSaveDraft = () => {
    setShowErrors(validation.errors.length > 0);
    saveDraft();
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
          />
          <MilestonesCard
            milestones={draft.milestones}
            onAdd={addMilestone}
            onUpdate={updateMilestone}
            onRemove={removeMilestone}
          />
          <DeliverablesCard
            deliverables={draft.deliverables}
            milestones={draft.milestones}
            onAdd={addDeliverable}
            onUpdate={updateDeliverable}
            onRemove={removeDeliverable}
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
            resumed={hasSavedDraft}
            onDiscard={discardDraft}
          />
          <HowItWorksCard />
        </div>
      </div>
    </AppShell>
  );
}
