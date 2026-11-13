import Card from "@/components/Card/Card";
import Field from "@/components/Field/Field";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import type { DraftFeature } from "@/lib/projectDraft";

import styles from "./CreateProject.module.css";

type FeaturesCardProps = {
  features: DraftFeature[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<DraftFeature>) => void;
  onRemove: (id: string) => void;
  /** Id of a just-added row whose title field should receive focus. */
  focusId?: string | null;
};

export default function FeaturesCard({
  features,
  onAdd,
  onUpdate,
  onRemove,
  focusId,
}: FeaturesCardProps) {
  return (
    <Card>
      <SectionHeader
        title="Major features"
        description="Product scope — separate from the timeline. High-level capabilities. Not dated. Not nested under milestones."
        action="+ Add feature"
        onAction={onAdd}
      />
      {features.length === 0 && (
        <p className={styles.emptyRow}>Add the product areas DevSync will map activity to.</p>
      )}
      {features.map((feature) => (
        <div key={feature.id} className={styles.editRow}>
          <Field
            label="Feature"
            value={feature.title}
            autoFocus={feature.id === focusId}
            placeholder="Feature name"
            onChange={(title) => onUpdate(feature.id, { title })}
          />
          <button
            type="button"
            className={styles.removeButton}
            onClick={() => onRemove(feature.id)}
            aria-label={`Remove feature ${feature.title || "untitled"}`}
          >
            Remove
          </button>
        </div>
      ))}
    </Card>
  );
}
