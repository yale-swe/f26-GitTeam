import Card from "@/components/Card/Card";
import SectionHeader from "@/components/SectionHeader/SectionHeader";

import styles from "./CreateProject.module.css";

export default function HowItWorksCard() {
  return (
    <Card>
      <SectionHeader title="How DevSync uses this" />
      <p className={styles.bodySmall}>
        The plan becomes the reference point for project health. Repository work and Discord context are
        compared with your features, milestones, and deliverables.
      </p>
      <p className={styles.bodySmall}>
        Features = what · Milestones = when · Deliverables = concrete work under a milestone
      </p>
    </Card>
  );
}
