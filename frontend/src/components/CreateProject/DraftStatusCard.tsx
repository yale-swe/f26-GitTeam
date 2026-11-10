import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import Icon from "@/components/Icon/Icon";
import SectionHeader from "@/components/SectionHeader/SectionHeader";

import styles from "./CreateProject.module.css";

type DraftStatusCardProps = {
  lastSavedAt: Date | null;
  hasSavedDraft: boolean;
  resumed: boolean;
  onDiscard: () => void;
  onFillExample?: () => void;
};

function formatSavedAt(date: Date | null): string {
  if (!date) return "Not saved yet";
  return `Draft saved at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function DraftStatusCard({
  lastSavedAt,
  hasSavedDraft,
  resumed,
  onDiscard,
  onFillExample,
}: DraftStatusCardProps) {
  return (
    <Card tone="muted">
      <SectionHeader title="Draft" />
      <div className={styles.draftStatusRow}>
        <Icon name="check-14-green" />
        <p className={styles.bodySmall}>{formatSavedAt(lastSavedAt)}</p>
      </div>
      {resumed && (
        <p className={styles.bodySmall}>Resumed from your previously saved draft on this device.</p>
      )}
      <p className={styles.bodySmall}>
        Your plan is auto-saved in this browser as you edit, so you can pick up where you left off.
      </p>
      {onFillExample && (
        <Button onClick={onFillExample} fullWidth>
          Fill example plan
        </Button>
      )}
      {hasSavedDraft && (
        <Button onClick={onDiscard} fullWidth>
          Discard draft
        </Button>
      )}
    </Card>
  );
}
