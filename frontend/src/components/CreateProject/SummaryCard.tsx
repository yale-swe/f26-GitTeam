import Card from "@/components/Card/Card";
import Field from "@/components/Field/Field";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import type { PlanDraft } from "@/lib/projectDraft";

import styles from "./CreateProject.module.css";

type SummaryCardProps = {
  draft: PlanDraft;
  onChange: (patch: Partial<PlanDraft>) => void;
  showErrors: boolean;
};

export default function SummaryCard({ draft, onChange, showErrors }: SummaryCardProps) {
  return (
    <Card>
      <SectionHeader
        title="Project summary"
        description="Give the team enough context to understand the outcome and scope."
      />
      <Field
        label="Project name"
        value={draft.name}
        placeholder="e.g. Campus Cart"
        onChange={(name) => onChange({ name })}
        error={showErrors && !draft.name.trim() ? "A project name is required." : undefined}
      />
      <Field
        label="What are you building?"
        value={draft.summary}
        multiline
        placeholder="Describe the outcome your team is working toward."
        hint="Keep this outcome-focused. You can add technical context below."
        onChange={(summary) => onChange({ summary })}
        error={showErrors && !draft.summary.trim() ? "A summary is required." : undefined}
      />
      <div className={styles.detailsRow}>
        <Field
          label="Target deadline"
          type="date"
          value={draft.deadline}
          className={styles.deadlineField}
          onChange={(deadline) => onChange({ deadline })}
        />
        <Field
          label="Project owner"
          value={draft.owner}
          placeholder="Who leads this project?"
          className={styles.growField}
          onChange={(owner) => onChange({ owner })}
        />
        <Field
          label="Team"
          value={draft.team}
          placeholder="e.g. CS 424 · Team 7"
          className={styles.growField}
          onChange={(team) => onChange({ team })}
        />
      </div>
    </Card>
  );
}
