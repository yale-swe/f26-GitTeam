import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import SectionHeader from "@/components/SectionHeader/SectionHeader";

import styles from "./CreateProject.module.css";

type ContinueCardProps = {
  errorCount: number;
  onSaveDraft: () => void;
};

export default function ContinueCard({ errorCount, onSaveDraft }: ContinueCardProps) {
  const blocked = errorCount > 0;

  return (
    <Card>
      <SectionHeader title="Ready to continue?" />
      <p className={styles.bodySmall}>
        Connect GitHub and Discord next so DevSync can interpret progress against this plan. You can edit
        any detail later.
      </p>
      {blocked && (
        <p className={styles.continueBlocker}>
          Fix {errorCount} required item{errorCount === 1 ? "" : "s"} to continue.
        </p>
      )}
      <Button
        variant="primary"
        icon="arrow-right-15-white"
        href="/projects/new/integrations"
        disabled={blocked}
        fullWidth
      >
        Continue to integrations
      </Button>
      <Button onClick={onSaveDraft} fullWidth>
        Save draft
      </Button>
    </Card>
  );
}
