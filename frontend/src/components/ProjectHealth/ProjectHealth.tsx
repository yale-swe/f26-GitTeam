import ActivityRow from "@/components/ActivityRow/ActivityRow";
import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import Icon, { type IconName } from "@/components/Icon/Icon";
import PageHeader from "@/components/PageHeader/PageHeader";
import ProgressBar from "@/components/ProgressBar/ProgressBar";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import StatusPill from "@/components/StatusPill/StatusPill";
import { toTimelineState, formatShortDate, statusToColor, healthToText, daysUntil, timeAgo, plural, dueText } from "@/lib/dashboardFormat";
import type { Dashboard } from "@/lib/types";
import styles from "./ProjectHealth.module.css";

const featureWork = [
  { name: "Listings and discovery", segments: 9, meta: "12 commits · 2 PRs", value: "82%" },
  { name: "Reservation and exchange", segments: 7, meta: "9 commits · 2 PRs", value: "61%" },
  { name: "Verified accounts", segments: 9, meta: "4 commits · 1 PR", value: "90%" },
  { name: "Moderation and reports", segments: 3, meta: "No activity this week", value: "25%" },
];

type ProjectHealthProps = {
  dashboard: Dashboard;
};

export default function ProjectHealth({ dashboard }: ProjectHealthProps) {
  const { project, healthScore, overallHealth, nextSteps, latestSummary, upcomingDeadlines, blockers, recentActivity } = dashboard;
  const healthStatus = overallHealth;

  const githubActivity = recentActivity.filter((item) => item.source === "github");
  const evidence: { label: string; dot: IconName }[] = [
    { label: plural(githubActivity.length, "GitHub update"), dot: "dot-7-green" },
    { label: plural(blockers.length, "unresolved blocker"), dot: "dot-7-amber" },
  ];
  const timeline = project.milestones.map((milestone) => ({
    label: milestone.title,
    date: formatShortDate(milestone.dueAt),
    state: toTimelineState(milestone.status),
  }));
  const nextDeadline = upcomingDeadlines[0];
  const isOverdue = nextDeadline ? daysUntil(nextDeadline.dueAt) < 0 : false;
  const milestones = project.milestones;
  const hasMilestones = milestones.length > 0;
  const completedCount = milestones.filter((m) => m.status === "completed").length;
  const progressPercent = milestones.length === 0 ? 0 : Math.round((completedCount / milestones.length) * 100);
  const currentIndex = milestones.findIndex((m) => m.status !== "completed");
  const currentMilestone = milestones[currentIndex];

  // Progress of the current milestone, from its deliverables
  const currentDeliverables = currentMilestone
    ? project.deliverables.filter((d) => d.milestoneId === currentMilestone.id)
    : [];
  const completedDeliverables = currentDeliverables.filter((d) => d.status === "completed").length;
  const blockedDeliverables = currentDeliverables.filter((d) => d.status === "blocked").length;
  const remainingDeliverables = currentDeliverables.length - completedDeliverables;
  const deliverablePercent =
    currentDeliverables.length === 0 ? 0 : Math.round((completedDeliverables / currentDeliverables.length) * 100);

  const metrics: { label: string; value: string; note: string; tone?: "green" | "amber" | "red" | "gray" }[] = [
    {
      label: "Overall health",
      value: healthScore == null ? "— / 100" : `${healthScore} / 100`,
      note: healthScore == null ? "Not enough data to calculate yet" : "Calculated from current project data",
      tone: statusToColor(healthStatus),
    },
    {
      label: "Plan progress",
      value: hasMilestones ? `${progressPercent}%` : "—",
      note: hasMilestones ? `${completedCount} of ${milestones.length} milestones complete` : "No milestones yet",
    },
    {
      label: "Current milestone",
      value: !hasMilestones
        ? "—"
        : currentMilestone
          ? `${currentIndex + 1} / ${milestones.length}`
          : "All complete",
      note: !hasMilestones
        ? "Add milestones to the project plan"
        : currentMilestone
          ? `${currentMilestone.title} · ${dueText(currentMilestone.dueAt)}`
          : "Every milestone is done",
    },
    { label: "Recent change", value: "—", note: "Not enough history yet" },
  ];
  return (
    <AppShell activeNav="health">
      <PageHeader
        eyebrow={project.name}
        title="Project health"
        description="Where the project stands based on the plan, GitHub work, and Discord context."
        actions={
          <Button variant="primary" icon="activity-15-white">
            Sync now
          </Button>
        }
      />

      <Card className={styles.executiveSummary}>
        <div className={styles.summaryHeading}>
          <div className={styles.question}>
            <p className={styles.overline}>Executive summary</p>
            <p className={styles.questionTitle}>Where does the project stand?</p>
          </div>
          <StatusPill tone={statusToColor(healthStatus)} dot>
            {healthToText(healthStatus)}
          </StatusPill>
        </div>
        <p className={styles.summaryBody}>
          {latestSummary ? latestSummary.text : "No summary has been generated yet."}
        </p>
        <div className={styles.evidenceRow}>
          {evidence.map((item) => (
            <div key={item.label} className={styles.evidence}>
              <Icon name={item.dot} />
              <p>{item.label}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className={styles.metricsRow}>
        {metrics.map((metric) => (
          <div key={metric.label} className={styles.metric}>
            <p className={styles.metricLabel}>{metric.label}</p>
            <p className={`${styles.metricValue} ${metric.tone ? styles[metric.tone] : ""}`}>
              {metric.value}
            </p>
            <p className={styles.metricNote}>{metric.note}</p>
          </div>
        ))}
      </div>

      <div className={styles.workspace}>
        <div className={styles.mainColumn}>
          <Card>
            <SectionHeader
              title="Milestone timeline"
              description="Progress against the approved plan"
              action="View all milestones"
            />
            <div className={styles.timeline}>
              {timeline.map((item, i) => {
                const isLast = i === timeline.length - 1;
                return (
                  <div key={item.label} className={styles.timelineItem}>
                    <div className={styles.track}>
                      <span className={`${styles.marker} ${styles[item.state]}`}>
                        {item.state === "done" ? <Icon name="check-12-white" /> : i + 1}
                      </span>
                      {!isLast && (
                        <span
                          className={`${styles.connector} ${item.state === "done" ? styles.connectorDone : ""}`}
                        />
                      )}
                    </div>
                    <div className={styles.timelineCopy}>
                      <p className={item.state === "current" ? styles.timelineCurrent : undefined}>
                        {item.label}
                      </p>
                      <p className={styles.timelineDate}>{item.date}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {currentMilestone && currentDeliverables.length > 0 && (
              <div className={styles.currentProgress}>
                <div className={styles.currentProgressLabel}>
                  <p>{currentMilestone.title} progress</p>
                  <p className={styles.currentProgressValue}>{deliverablePercent}%</p>
                </div>
                <ProgressBar filled={Math.round(deliverablePercent / 10)} />
                <p className={styles.currentProgressNote}>
                  {`${plural(remainingDeliverables, "deliverable")} remaining`}
                  {blockedDeliverables > 0 && ` · ${blockedDeliverables} blocked`}
                </p>
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader
              title="Recent GitHub work"
              description="Latest commits and pull requests"
            />
            {githubActivity.length === 0 ? (
              <p className={styles.bodySmall}>No recent GitHub activity.</p>
            ) : (
              githubActivity.map((item) => (
                <ActivityRow
                  key={item.id}
                  icon="git-pull-request-15-gray"
                  title={item.title}
                  meta={`GitHub · ${timeAgo(item.occurredAt)}`}
                />
              ))
            )}
          </Card>

          <Card>
            <SectionHeader
              title="Work by feature"
              description="Recent repository work aligned to the project plan"
            />
            {featureWork.map((feature) => (
              <div key={feature.name} className={styles.featureProgress}>
                <p className={styles.featureName}>{feature.name}</p>
                <div className={styles.featureBar}>
                  <ProgressBar filled={feature.segments} />
                  <p className={styles.featureMeta}>{feature.meta}</p>
                </div>
                <p className={styles.featureValue}>{feature.value}</p>
              </div>
            ))}
          </Card>
        </div>

        <div className={styles.sideColumn}>
          <Card tone="amber">
            {nextDeadline ? (
              <>
                <SectionHeader
                  title="Upcoming deadline"
                  description={`${nextDeadline.title} · ${formatShortDate(nextDeadline.dueAt)}`}
                />
                <div className={styles.countdown}>
                  <p className={`${styles.countdownValue} ${isOverdue ? styles.overdue : ""}`}>
                    {dueText(nextDeadline.dueAt)}
                  </p>
                  {isOverdue ? (
                    <StatusPill tone="red" dot>
                      Overdue
                    </StatusPill>
                  ) : (
                    nextDeadline.status === "at_risk" && (
                      <StatusPill tone="amber" dot>
                        At risk
                      </StatusPill>
                    )
                  )}
                </div>
                {blockers.length > 0 && (
                  <p className={styles.bodySmall}>
                    {plural(blockers.length, "open blocker")} could affect this deadline
                  </p>
                )}
              </>
            ) : (
              <SectionHeader title="Upcoming deadline" description="No upcoming deadline" />
            )}
          </Card>

          <Card>
            <SectionHeader
              title="Blockers"
              description="Summarized from selected Discord channels"
              action="View context"
            />
            {blockers.length === 0 ? (
              <p className={styles.bodySmall}>No open blockers.</p>
            ) : (
              blockers.map((blocker) => (
                <div key={blocker} className={`${styles.contextItem} ${styles.contextBlocker}`}>
                  <div className={styles.contextType}>
                    <StatusPill tone="amber">Blocker</StatusPill>
                  </div>
                  <p className={styles.contextTitle}>{blocker}</p>
                </div>
              ))
            )}
          </Card>

          <Card>
            <SectionHeader title="Contributor activity" description="Last 7 days" />
            <p className={styles.bodySmall}>Contributor activity will appear once GitHub sync is connected.</p>
          </Card>

          <Card tone="blue">
            <SectionHeader
              title="Suggested next steps"
              description="Recommended actions based on current blockers and deadlines"
            />
            <div className={styles.divider} />
            {nextSteps.map((step, i) => (
              <div key={step} className={styles.nextStep}>
                <span className={styles.stepNumber}>{i + 1}</span>
                <p>{step}</p>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
