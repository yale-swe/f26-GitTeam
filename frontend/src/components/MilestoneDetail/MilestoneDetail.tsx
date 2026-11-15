"use client";

import { useState } from "react";
import ActivityRow from "@/components/ActivityRow/ActivityRow";
import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import Checkbox from "@/components/Checkbox/Checkbox";
import Field from "@/components/Field/Field";
import PageHeader from "@/components/PageHeader/PageHeader";
import ProgressBar from "@/components/ProgressBar/ProgressBar";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import StatusPill from "@/components/StatusPill/StatusPill";
import {
  deliverableStatusToText,
  deliverableStatusToTone,
  formatLongDate,
  milestoneStatusToText,
  milestoneStatusToTone,
  plural,
  remainingText,
  timeAgo,
} from "@/lib/dashboardFormat";
import type {
  ActivityItem,
  Deliverable,
  MilestoneDetail as MilestoneDetailData,
  MilestoneStatus,
  MilestoneUpdate,
} from "@/lib/types";
import styles from "./MilestoneDetail.module.css";

type MilestoneDetailProps = {
  detail: MilestoneDetailData;
  projectName: string;
  /** The milestones list for this project. */
  backHref: string;
  /** Set when the last change could not be saved. */
  errorMessage?: string | null;
  onToggleDeliverable: (deliverable: Deliverable) => void;
  onAddDeliverable: (title: string) => Promise<void>;
  onSaveMilestone: (changes: MilestoneUpdate) => Promise<void>;
};

const STATUS_OPTIONS: MilestoneStatus[] = ["planned", "in_progress", "at_risk", "completed"];

function activityRows(items: ActivityItem[]) {
  return items.map((item) => (
    <ActivityRow
      key={item.id}
      icon={item.source === "github" ? "git-pull-request-14-gray" : "message-square-14-gray"}
      title={item.title}
      meta={`${item.kind.replace(/_/g, " ")} · ${timeAgo(item.occurredAt)}`}
    />
  ));
}

export default function MilestoneDetail({
  detail,
  projectName,
  backHref,
  errorMessage,
  onToggleDeliverable,
  onAddDeliverable,
  onSaveMilestone,
}: MilestoneDetailProps) {
  const { progress, deliverables, recentActivity } = detail;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(detail.title);
  const [dueDate, setDueDate] = useState(detail.dueAt.slice(0, 10));
  const [status, setStatus] = useState<MilestoneStatus>(detail.status);
  const [formError, setFormError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const github = recentActivity.filter((item) => item.source === "github");
  const discord = recentActivity.filter((item) => item.source === "discord");
  const blocked = deliverables.filter((d) => d.status === "blocked").length;

  function openEditor() {
    setTitle(detail.title);
    setDueDate(detail.dueAt.slice(0, 10));
    setStatus(detail.status);
    setFormError(null);
    setEditing(true);
  }

  async function saveMilestone() {
    if (title.trim() === "") return setFormError("Enter a milestone name.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return setFormError("Enter a valid target date.");
    try {
      await onSaveMilestone({ title: title.trim(), dueAt: `${dueDate}T00:00:00Z`, status });
      setEditing(false);
    } catch {
      setFormError("The milestone could not be saved. Please try again.");
    }
  }

  async function saveDeliverable() {
    if (newTitle.trim() === "") return setAddError("Enter a deliverable name.");
    try {
      await onAddDeliverable(newTitle.trim());
      setNewTitle("");
      setAdding(false);
      setAddError(null);
    } catch {
      setAddError("The deliverable could not be added. Please try again.");
    }
  }

  return (
    <AppShell activeNav="milestones" projectName={projectName}>
      <PageHeader
        eyebrow={`${projectName} · Milestone ${detail.position} of ${detail.totalMilestones}`}
        title={detail.title}
        description={`Target date ${formatLongDate(detail.dueAt)}.`}
        backHref={backHref}
        backLabel="Back to milestones"
        actions={
          <Button icon="edit-15-gray" onClick={openEditor}>
            Edit milestone
          </Button>
        }
      />

      {errorMessage && <p role="alert" className={styles.errorText}>{errorMessage}</p>}

      {editing && (
        <Card>
          <SectionHeader title="Edit milestone" />
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              void saveMilestone();
            }}
          >
            <Field label="Name" value={title} onChange={setTitle} />
            <Field label="Target date" type="date" value={dueDate} onChange={setDueDate} />
            <label className={styles.selectLabel}>
              Status
              <select
                className={styles.select}
                value={status}
                onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {milestoneStatusToText(option)}
                  </option>
                ))}
              </select>
            </label>
            {formError && <p role="alert" className={styles.errorText}>{formError}</p>}
            <div className={styles.formActions}>
              <Button variant="primary" type="submit">
                Save changes
              </Button>
              <Button onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <div className={styles.summaryRow}>
        <div className={`${styles.summaryCard} ${styles.statusSummary}`}>
          <div className={styles.labelRow}>
            <p className={styles.summaryLabel}>Milestone status</p>
            <StatusPill tone={milestoneStatusToTone(detail.status)} dot>
              {milestoneStatusToText(detail.status)}
            </StatusPill>
          </div>
          <p className={styles.summaryValue}>{progress.percent}% complete</p>
          <ProgressBar filled={Math.round(progress.percent / 10)} />
          <p className={styles.summaryNote}>
            {progress.total === 0
              ? "No deliverables yet"
              : `${progress.completed} of ${plural(progress.total, "deliverable")} done${blocked ? ` · ${blocked} blocked` : ""}`}
          </p>
        </div>
        <div className={`${styles.summaryCard} ${styles.fixedSummary}`}>
          <p className={styles.summaryLabel}>Target date</p>
          <p className={styles.summaryValue}>{formatLongDate(detail.dueAt)}</p>
          <p className={styles.summaryNote}>
            {detail.status === "completed" ? "Completed" : remainingText(detail.dueAt)}
          </p>
        </div>
        <div className={`${styles.summaryCard} ${styles.fixedSummary}`}>
          <p className={styles.summaryLabel}>Recent project activity</p>
          <p className={`${styles.summaryValue} ${styles.wrapValue}`}>
            {plural(recentActivity.length, "item")}
          </p>
          <p className={styles.summaryNote}>
            {recentActivity.length > 0
              ? `Latest ${timeAgo(recentActivity[0].occurredAt)}`
              : "No synced activity yet"}
          </p>
        </div>
      </div>

      <div className={styles.workspace}>
        <div className={styles.mainColumn}>
          <Card>
            <SectionHeader
              title="Deliverables"
              description="Definition of done for this milestone"
              action="+ Add deliverable"
              onAction={() => setAdding(true)}
            />
            {adding && (
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveDeliverable();
                }}
              >
                <Field
                  label="Deliverable name"
                  value={newTitle}
                  onChange={setNewTitle}
                  autoFocus
                />
                {addError && <p role="alert" className={styles.errorText}>{addError}</p>}
                <div className={styles.formActions}>
                  <Button variant="primary" type="submit">
                    Add
                  </Button>
                  <Button
                    onClick={() => {
                      setAdding(false);
                      setAddError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
            {deliverables.length === 0 && !adding && (
              <p className={styles.empty}>No deliverables yet. Add one to start tracking progress.</p>
            )}
            {deliverables.map((item) => (
              <div key={item.id} className={styles.deliverable}>
                <button
                  type="button"
                  className={styles.checkButton}
                  aria-label={`Mark "${item.title}" ${item.status === "completed" ? "incomplete" : "complete"}`}
                  aria-pressed={item.status === "completed"}
                  onClick={() => onToggleDeliverable(item)}
                >
                  <Checkbox
                    size={19}
                    checked={item.status === "completed"}
                    warning={item.status === "blocked"}
                  />
                </button>
                <div className={styles.deliverableCopy}>
                  <p className={styles.deliverableTitle}>{item.title}</p>
                </div>
                <div className={styles.ownership}>
                  <StatusPill tone={deliverableStatusToTone(item.status)}>
                    {deliverableStatusToText(item.status)}
                  </StatusPill>
                </div>
              </div>
            ))}
          </Card>

          <Card>
            <SectionHeader
              title="Recent GitHub activity"
              description="Latest synced work in this project. Not yet linked to individual milestones."
            />
            {github.length > 0 ? (
              activityRows(github)
            ) : (
              <p className={styles.empty}>No GitHub activity has been synced yet.</p>
            )}
          </Card>
        </div>

        <div className={styles.sideColumn}>
          <Card>
            <SectionHeader title="Active blocker" />
            <p className={styles.empty}>
              {blocked > 0
                ? `${plural(blocked, "deliverable")} marked blocked. Blocker details are not recorded yet.`
                : "No blockers recorded."}
            </p>
          </Card>

          <Card>
            <SectionHeader
              title="Discord context"
              description="Recent messages from the connected channel"
            />
            {discord.length > 0 ? (
              activityRows(discord)
            ) : (
              <p className={styles.empty}>No Discord messages have been synced yet.</p>
            )}
          </Card>

          <Card>
            <SectionHeader title="Owners" description="People accountable for this milestone" />
            <p className={styles.empty}>Owners are not tracked yet.</p>
          </Card>

          <Card>
            <SectionHeader title="Recommended next actions" />
            <p className={styles.empty}>No recommended actions yet.</p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
