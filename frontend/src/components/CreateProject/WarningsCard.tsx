import Card from "@/components/Card/Card";
import Icon from "@/components/Icon/Icon";
import type { ValidationResult } from "@/lib/projectDraft";

import styles from "./CreateProject.module.css";

type WarningsCardProps = {
  validation: ValidationResult;
};

export default function WarningsCard({ validation }: WarningsCardProps) {
  const { errors, warnings } = validation;
  const total = errors.length + warnings.length;

  if (total === 0) {
    return (
      <Card tone="muted">
        <div className={styles.reviewCue}>
          <Icon name="check-14-green" />
          <p>No issues. Your plan is ready to continue.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card tone="amber">
      <div className={styles.reviewCue}>
        <Icon name="alert-triangle-16-amber" />
        <p>
          {total} item{total === 1 ? "" : "s"} need attention
        </p>
      </div>

      {errors.length > 0 && (
        <div className={styles.warningGroup}>
          <p className={styles.warningGroupLabel}>Required before continuing</p>
          <ul className={styles.warningList}>
            {errors.map((message) => (
              <li key={message} className={styles.warningItemBlocking}>
                {message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className={styles.warningGroup}>
          <p className={styles.warningGroupLabel}>Suggestions</p>
          <ul className={styles.warningList}>
            {warnings.map((message) => (
              <li key={message} className={styles.warningItem}>
                {message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
