import Link from "next/link";
import AppShell from "@/components/AppShell/AppShell";
import PageHeader from "@/components/PageHeader/PageHeader";
import ProgressBar from "@/components/ProgressBar/ProgressBar";
import StatusPill from "@/components/StatusPill/StatusPill";
import {
  deliverableProgress,
  formatLongDate,
  milestoneStatusToText,
  milestoneStatusToTone,
  plural,
  remainingText,
} from "@/lib/dashboardFormat";
import type { Project } from "@/lib/types";
import type { ProjectOption } from "@/components/Sidebar/Sidebar";
import styles from "./MilestonesList.module.css";

type MilestonesListProps = {
  project: Project;
  /** The user's projects, for the sidebar project switcher. */
  projects?: ProjectOption[];
};

export default function MilestonesList({ project, projects }: MilestonesListProps) {
  const milestones = [...project.milestones].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  );

  return (
    <AppShell activeNav="milestones" projectName={project.name} projectId={project.id} projects={projects}>
      <PageHeader
        eyebrow={project.name}
        title="Milestones"
        description="Every milestone in the project plan. Open one to see its deliverables and progress."
      />

      {milestones.length === 0 ? (
        <p className={styles.empty}>This project doesn&apos;t have any milestones yet.</p>
      ) : (
        <ol className={styles.list} aria-label="Milestones">
          {milestones.map((milestone, index) => {
            const progress = deliverableProgress(
              project.deliverables.filter((d) => d.milestoneId === milestone.id),
            );
            return (
              <li key={milestone.id}>
                <Link
                  href={`/milestones/${milestone.id}?project=${project.id}`}
                  className={styles.item}
                >
                  <span className={styles.number}>{index + 1}</span>
                  <span className={styles.copy}>
                    <span className={styles.title}>{milestone.title}</span>
                    <span className={styles.meta}>
                      {formatLongDate(milestone.dueAt)}
                      {milestone.status !== "completed" && ` · ${remainingText(milestone.dueAt)}`}
                    </span>
                  </span>
                  <span className={styles.progress}>
                    <ProgressBar filled={Math.round(progress.percent / 10)} />
                    <span className={styles.progressNote}>
                      {progress.total === 0
                        ? "No deliverables yet"
                        : `${progress.completed} of ${plural(progress.total, "deliverable")} done`}
                    </span>
                  </span>
                  <StatusPill tone={milestoneStatusToTone(milestone.status)}>
                    {milestoneStatusToText(milestone.status)}
                  </StatusPill>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </AppShell>
  );
}
