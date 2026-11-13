import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import Icon from "@/components/Icon/Icon";

import styles from "./CreateProject.module.css";

export default function ImportCard() {
  return (
    <Card tone="blue">
      <span className={styles.importIcon}>
        <Icon name="upload-16-blue" />
      </span>
      <div className={styles.importCopy}>
        <p className={styles.importTitle}>Already have a specification?</p>
        <p className={styles.bodySmall}>
          Import a proposal, requirements document, or README. DevSync will extract the plan for review.
        </p>
      </div>
      <Button icon="file-text-15-gray" href="/projects/new/import" fullWidth>
        Import specification
      </Button>
      <p className={styles.fileTypes}>PDF, DOCX, Markdown · up to 10 MB</p>
    </Card>
  );
}
