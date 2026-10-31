import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Icon, { type IconName } from "@/components/Icon/Icon";
import PageHeader from "@/components/PageHeader/PageHeader";
import ProgressBar from "@/components/ProgressBar/ProgressBar";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import StatusPill from "@/components/StatusPill/StatusPill";
import styles from "./ProjectsOverview.module.css";
import Link from "next/link";
import { daysUntil, formatShortDate, healthToText, plural, statusToColor, timeAgo } from "@/lib/dashboardFormat";
import type { Dashboard } from "@/lib/types";

type ProjectsOverviewProps = {
  dashboards: Dashboard[];
};

export default function ProjectsOverview({ dashboards }: ProjectsOverviewProps) {
  const onTrack = dashboards.filter((d) => d.overallHealth === "healthy").length;
  const needsReview = dashboards.filter((d) => d.overallHealth === "at_risk" || d.overallHealth === "blocked").length;
  const openBlockers = dashboards.reduce((total, d) => total + d.blockers.length, 0);
  const summary: { label: string; value: string; note: string; dot: IconName }[] = [
    { label: "Active projects", value: String(dashboards.length), note: "In your workspace", dot: "dot-7-blue" },
    { label: "On track", value: String(onTrack), note: "Healthy right now", dot: "dot-7-green" },
    { label: "Needs review", value: String(needsReview), note: "At risk or blocked", dot: "dot-7-amber" },
    { label: "Open blockers", value: String(openBlockers), note: "Across all projects", dot: "dot-7-amber" },
  ];
  return (
    <AppShell activeNav="projects">
      <PageHeader
        title="Projects"
        description="Monitor delivery health, deadlines, and team activity across your workspace."
        actions={
          <Button variant="primary" icon="plus-15-white" href="/projects/new">
            New project
          </Button>
        }
      />

      <div className={styles.summaryRow}>
        {
          summary.map((item) => (
            <div key={item.label} className={styles.summaryCard}>
              <div className={styles.summaryLabel}>
                <p>{item.label}</p>
                <Icon name={item.dot} />
              </div>
              <p className={styles.summaryValue}>{item.value}</p>
              <p className={styles.summaryNote}>{item.note}</p>
            </div>
          ))
        }
      </div>

      <div className={styles.projectsSection}>
        <SectionHeader title="All projects" description="Your team's projects" />
        {dashboards.length === 0 ? (
          <p>No projects yet. Create one to get started.</p>
        ) : (
          <div className={styles.projectGrid}>
            {dashboards.map((dashboard) => (
              <ProjectCard key={dashboard.project.id} dashboard={dashboard} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// helper function - project names to initials
function initials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ProjectCard({ dashboard }: { dashboard: Dashboard }) {
  const { project, overallHealth, recentActivity, blockers } = dashboard;
  const milestones = project.milestones;

  const completedCount = milestones.filter((m) => m.status === "completed").length;
  const progressPercent = milestones.length === 0 ? 0 : Math.round((completedCount / milestones.length) * 100);
  const nextMilestone = milestones.find((m) => m.status !== "completed");
  const isOverdue = nextMilestone ? daysUntil(nextMilestone.dueAt) < 0 : false;

  const githubCount = recentActivity.filter((item) => item.source === "github").length;
  const lastActivity = recentActivity[0];
  return (
    <Link href="/health" className={styles.projectCard}>
      <div className={styles.projectHeading}>
        <div className={styles.identity}>
          <span className={styles.projectMark}>{initials(project.name)}</span>
          <div className={styles.projectCopy}>
            <p className={styles.projectName}>{project.name}</p>
            <p className={styles.updated}>
              {lastActivity ? `Updated ${timeAgo(lastActivity.occurredAt)}` : "No activity yet"}
            </p>
          </div>
        </div>
        <StatusPill tone={statusToColor(overallHealth)} dot>
          {healthToText(overallHealth)}
        </StatusPill>
      </div>

      <p className={styles.projectDescription}>{project.summary}</p>

      <div className={styles.progress}>
        <div className={styles.progressLabel}>
          <p>Plan progress</p>
          <p className={styles.progressValue}>{progressPercent}%</p>
        </div>
        <ProgressBar filled={Math.round(progressPercent / 10)} />
      </div>

      <div className={styles.facts}>
        <div className={`${styles.fact} ${styles.factGrow}`}>
          <p className={styles.factLabel}>Next milestone</p>
          <p className={styles.factValue}>{nextMilestone ? nextMilestone.title : "All complete"}</p>
        </div>
        <div className={`${styles.fact} ${styles.factDeadline}`}>
          <p className={styles.factLabel}>Deadline</p>
          <p className={`${styles.factValue} ${isOverdue ? styles.overdue : ""}`}>
            {nextMilestone ? formatShortDate(nextMilestone.dueAt) : "—"}
          </p>
        </div>
      </div>

      <div className={styles.recentActivity}>
        <div className={styles.activity}>
          <Icon name="activity-14-gray" />
          <p>
            {plural(githubCount, "GitHub update")} · {plural(blockers.length, "open blocker")}
          </p>
        </div>
      </div>
    </Link>
  );
}
