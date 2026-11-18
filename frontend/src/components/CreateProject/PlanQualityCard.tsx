import Card from "@/components/Card/Card";
import Checkbox from "@/components/Checkbox/Checkbox";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import type { QualityCheck } from "@/lib/projectDraft";

import styles from "./CreateProject.module.css";

type PlanQualityCardProps = {
  checks: QualityCheck[];
};

export default function PlanQualityCard({ checks }: PlanQualityCardProps) {
  const doneCount = checks.filter((check) => check.done).length;
  const description =
    doneCount === checks.length
      ? "Your plan is detailed enough to connect activity."
      : `${doneCount} of ${checks.length} quality checks complete.`;

  return (
    <Card>
      <SectionHeader title="Plan quality" description={description} />
      <div className={styles.divider} />
      {checks.map((check) => (
        <div key={check.label} className={styles.checkItem}>
          <Checkbox checked={check.done} />
          <div className={styles.checkCopy}>
            <p className={check.done ? styles.checkDone : styles.checkLabel}>{check.label}</p>
            {check.note && <p className={styles.checkNote}>{check.note}</p>}
          </div>
        </div>
      ))}
    </Card>
  );
}
