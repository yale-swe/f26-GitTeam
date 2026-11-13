import { useState } from "react";

import Card from "@/components/Card/Card";
import Field from "@/components/Field/Field";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import { formatLocalDate, type DraftDeliverable, type DraftMilestone } from "@/lib/projectDraft";

import styles from "./CreateProject.module.css";

type MilestonesCardProps = {
  milestones: DraftMilestone[];
  deliverables: DraftDeliverable[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<DraftMilestone>) => void;
  onRemove: (id: string) => void;
  onAddDeliverable: (milestoneId: string) => void;
  onUpdateDeliverable: (id: string, patch: Partial<DraftDeliverable>) => void;
  onRemoveDeliverable: (id: string) => void;
  onMoveDeliverable: (id: string, targetMilestoneId: string) => void;
  /** Id of a just-added row whose title field should receive focus. */
  focusId?: string | null;
};

function formatDate(value: string): string {
  if (!value) return value;
  return formatLocalDate(value, { month: "short", day: "numeric" });
}

export default function MilestonesCard({
  milestones,
  deliverables,
  onAdd,
  onUpdate,
  onRemove,
  onAddDeliverable,
  onUpdateDeliverable,
  onRemoveDeliverable,
  onMoveDeliverable,
  focusId,
}: MilestonesCardProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const endDrag = () => {
    setDragId(null);
    setDropTarget(null);
  };

  return (
    <Card>
      <SectionHeader
        title="Timeline: milestones & deliverables"
        description="Each deliverable lives inside one milestone."
        action="+ Add milestone"
        onAction={onAdd}
      />
      {milestones.length === 0 && (
        <p className={styles.emptyRow}>
          Add a milestone first — deliverables are created inside a milestone.
        </p>
      )}
      {milestones.map((milestone, i) => {
        const children = deliverables.filter((d) => d.milestoneId === milestone.id);
        const count = `${children.length} ${children.length === 1 ? "deliverable" : "deliverables"}`;
        return (
          <div key={milestone.id} className={styles.editRow}>
            <div className={styles.milestoneHeader}>
              <span className={styles.progressChip}>
                {count}
                {milestone.date ? ` · ${formatDate(milestone.date)}` : ""}
              </span>
            </div>
            <div className={styles.editRowFields}>
              <Field
                label={`Milestone ${i + 1}`}
                value={milestone.title}
                autoFocus={milestone.id === focusId}
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
            <div
              data-testid="deliverables-region"
              data-drop-active={dropTarget === milestone.id ? "true" : undefined}
              className={`${styles.nestedDeliverables} ${
                dropTarget === milestone.id ? styles.dropActive : ""
              }`}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dropTarget !== milestone.id) setDropTarget(milestone.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDropTarget((t) => (t === milestone.id ? null : t));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragId;
                if (id) onMoveDeliverable(id, milestone.id);
                endDrag();
              }}
            >
              <div className={styles.nestedHeader}>
                <span className={styles.nestedTitle}>Deliverables for this milestone</span>
                <button
                  type="button"
                  className={styles.addNestedButton}
                  onClick={() => onAddDeliverable(milestone.id)}
                >
                  + Add deliverable
                </button>
              </div>
              {children.length === 0 && (
                <p className={styles.emptyRow}>
                  Each milestone must have at least one deliverable.
                </p>
              )}
              {children.map((deliverable) => (
                <div
                  key={deliverable.id}
                  className={`${styles.nestedRow} ${dragId === deliverable.id ? styles.dragging : ""}`}
                >
                  <span
                    className={styles.dragHandle}
                    draggable
                    role="img"
                    aria-label="Drag to move deliverable"
                    title="Drag to another milestone"
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", deliverable.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragId(deliverable.id);
                    }}
                    onDragEnd={endDrag}
                  >
                    ⠿
                  </span>
                  <div className={styles.editRowFields}>
                    <Field
                      label="Deliverable"
                      value={deliverable.title}
                      autoFocus={deliverable.id === focusId}
                      placeholder="Deliverable name"
                      className={styles.flexField}
                      onChange={(title) => onUpdateDeliverable(deliverable.id, { title })}
                    />
                  </div>
                  {milestones.length > 1 && (
                    <label className={styles.moveLabel}>
                      Move to
                      <select
                        aria-label="Move to milestone"
                        className={styles.moveSelect}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) onMoveDeliverable(deliverable.id, e.target.value);
                        }}
                      >
                        <option value="">Choose…</option>
                        {milestones.map((m, idx) =>
                          m.id === milestone.id ? null : (
                            <option key={m.id} value={m.id}>
                              {m.title || `Milestone ${idx + 1}`}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  )}
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => onRemoveDeliverable(deliverable.id)}
                    aria-label={`Remove deliverable ${deliverable.title || "untitled"}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className={styles.removeButton}
              onClick={() => onRemove(milestone.id)}
              aria-label={`Remove milestone ${milestone.title || "untitled"}`}
            >
              Remove milestone
            </button>
          </div>
        );
      })}
    </Card>
  );
}
