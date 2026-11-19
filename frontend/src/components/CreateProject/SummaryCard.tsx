import Card from "@/components/Card/Card";
import Field from "@/components/Field/Field";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import type { PlanDraft } from "@/lib/projectDraft";

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
        hint="Keep this outcome-focused. Milestone dates carry the schedule."
        onChange={(summary) => onChange({ summary })}
        error={showErrors && !draft.summary.trim() ? "A summary is required." : undefined}
      />
    </Card>
  );
}
