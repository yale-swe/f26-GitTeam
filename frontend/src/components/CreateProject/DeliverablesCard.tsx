import Card from "@/components/Card/Card";
import Field from "@/components/Field/Field";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import type { DraftDeliverable, DraftMilestone } from "@/lib/projectDraft";

import styles from "./CreateProject.module.css";

type DeliverablesCardProps = {
  deliverables: DraftDeliverable[];
  milestones: DraftMilestone[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<DraftDeliverable>) => void;
  onRemove: (id: string) => void;
};

export default function DeliverablesCard({
  deliverables,
  milestones,
  onAdd,
  onUpdate,
  onRemove,
}: DeliverablesCardProps) {
  const milestoneOptions = milestones.filter((m) => m.title.trim());

  return (
    <Card>
      <SectionHeader
        title="Deliverables"
        description="Concrete outputs for each milestone. Assign an owner to each one."
        action="+ Add deliverable"
        onAction={onAdd}
      />
      {deliverables.length === 0 && (
        <p className={styles.emptyRow}>
          Optional, but recommended. Deliverables give milestones measurable outcomes.
        </p>
      )}
      {deliverables.map((deliverable) => (
        <div key={deliverable.id} className={styles.editRow}>
          <div className={styles.editRowFields}>
            <Field
              label="Deliverable"
              value={deliverable.title}
              placeholder="Deliverable name"
              className={styles.flexField}
              onChange={(title) => onUpdate(deliverable.id, { title })}
            />
            <Field
              label="Owner"
              value={deliverable.owner}
              placeholder="Owner"
              className={styles.ownerField}
              onChange={(owner) => onUpdate(deliverable.id, { owner })}
            />
          </div>
          <label className={styles.selectField}>
            <span className={styles.selectLabel}>Linked milestone</span>
            <select
              className={styles.select}
              value={deliverable.milestoneId ?? ""}
              onChange={(e) =>
                onUpdate(deliverable.id, { milestoneId: e.target.value || null })
              }
            >
              <option value="">No milestone</option>
              {milestoneOptions.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={styles.removeButton}
            onClick={() => onRemove(deliverable.id)}
            aria-label={`Remove deliverable ${deliverable.title || "untitled"}`}
          >
            Remove
          </button>
        </div>
      ))}
    </Card>
  );
}
