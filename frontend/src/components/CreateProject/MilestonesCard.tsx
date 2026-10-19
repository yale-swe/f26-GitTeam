import Card from "@/components/Card/Card";
import Field from "@/components/Field/Field";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import type { DraftMilestone } from "@/lib/projectDraft";

import styles from "./CreateProject.module.css";

type MilestonesCardProps = {
  milestones: DraftMilestone[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<DraftMilestone>) => void;
  onRemove: (id: string) => void;
};

export default function MilestonesCard({ milestones, onAdd, onUpdate, onRemove }: MilestonesCardProps) {
  return (
    <Card>
      <SectionHeader
        title="Milestones"
        description="Define concrete checkpoints with target dates for your team."
        action="+ Add milestone"
        onAction={onAdd}
      />
      {milestones.length === 0 && (
        <p className={styles.emptyRow}>No milestones yet. Add a checkpoint with a target date.</p>
      )}
      {milestones.map((milestone, i) => (
        <div key={milestone.id} className={styles.editRow}>
          <div className={styles.editRowFields}>
            <Field
              label={`Milestone ${i + 1}`}
              value={milestone.title}
              placeholder="Milestone name"
              className={styles.flexField}
              onChange={(title) => onUpdate(milestone.id, { title })}
            />
            <Field
              label="Target date"
              type="date"
              value={milestone.date}
              className={styles.dateField}
              onChange={(date) => onUpdate(milestone.id, { date })}
            />
          </div>
          <Field
            label="Detail"
            value={milestone.detail}
            placeholder="What is delivered at this milestone?"
            onChange={(detail) => onUpdate(milestone.id, { detail })}
          />
          <button
            type="button"
            className={styles.removeButton}
            onClick={() => onRemove(milestone.id)}
            aria-label={`Remove milestone ${milestone.title || "untitled"}`}
          >
            Remove
          </button>
        </div>
      ))}
    </Card>
  );
}
