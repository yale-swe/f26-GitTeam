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
};

export default function FeaturesCard({ features, onAdd, onUpdate, onRemove }: FeaturesCardProps) {
  return (
    <Card>
      <SectionHeader
        title="Major features"
        description="These become the high-level scope used to interpret GitHub activity."
        action="+ Add feature"
        onAction={onAdd}
      />
      {features.length === 0 && (
        <p className={styles.emptyRow}>No features yet. Add the first one to define your scope.</p>
      )}
      {features.map((feature) => (
        <div key={feature.id} className={styles.editRow}>
          <div className={styles.editRowFields}>
            <Field
              label="Feature"
              value={feature.title}
              placeholder="Feature name"
              className={styles.flexField}
              onChange={(title) => onUpdate(feature.id, { title })}
            />
            <Field
              label="Owner"
              value={feature.owner}
              placeholder="Owner"
              className={styles.ownerField}
              onChange={(owner) => onUpdate(feature.id, { owner })}
            />
          </div>
          <Field
            label="Detail"
            value={feature.detail}
            placeholder="What does this feature cover?"
            onChange={(detail) => onUpdate(feature.id, { detail })}
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
