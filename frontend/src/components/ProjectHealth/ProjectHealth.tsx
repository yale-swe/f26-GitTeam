"use client";

import { useEffect, useState } from "react";
import ActivityRow from "@/components/ActivityRow/ActivityRow";
import AppShell from "@/components/AppShell/AppShell";
import Avatar from "@/components/Avatar/Avatar";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import Icon, { type IconName } from "@/components/Icon/Icon";
import PageHeader from "@/components/PageHeader/PageHeader";
import ProgressBar from "@/components/ProgressBar/ProgressBar";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import StatusPill from "@/components/StatusPill/StatusPill";
import { apiFetch } from "@/lib/api";
import { toTimelineState, formatShortDate, statusToColor, healthToText, daysUntil, timeAgo, plural, dueText } from "@/lib/dashboardFormat";
import type { Dashboard, HealthScore } from "@/lib/types";
import styles from "./ProjectHealth.module.css";

const evidence: { label: string; dot: IconName }[] = [
  { label: "14 commits since Monday", dot: "dot-7-green" },
  { label: "2 unresolved blockers", dot: "dot-7-amber" },
  { label: "1 scope decision this week", dot: "dot-7-blue" },
];

const featureWork = [
  { name: "Listings and discovery", segments: 9, meta: "12 commits · 2 PRs", value: "82%" },
  { name: "Reservation and exchange", segments: 7, meta: "9 commits · 2 PRs", value: "61%" },
  { name: "Verified accounts", segments: 9, meta: "4 commits · 1 PR", value: "90%" },
  { name: "Moderation and reports", segments: 3, meta: "No activity this week", value: "25%" },
];

const contributors: { initials: string; name: string; meta: string; tone: "blue" | "dark" | "light" }[] = [
  { initials: "SR", name: "Sam Rivera", meta: "18 commits · 2 PRs", tone: "blue" },
  { initials: "JK", name: "Jamie Kim", meta: "9 commits · 1 PR", tone: "dark" },
  { initials: "AM", name: "Alex Morgan", meta: "6 commits · 14 reviews", tone: "light" },
  { initials: "TN", name: "Taylor Ng", meta: "4 commits · 2 reviews", tone: "light" },
];

type ProjectHealthProps = {
  dashboard: Dashboard;
};

export default function ProjectHealth({ dashboard }: ProjectHealthProps) {
  const { project, integrations, nextSteps, latestSummary, upcomingDeadlines, blockers, recentActivity } = dashboard;
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [healthScoreError, setHealthScoreError] = useState(false);
  const healthStatus = healthScore?.status ?? "unknown";

  useEffect(() => {
    const controller = new AbortController();

    apiFetch<HealthScore>("/api/health/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        milestones: project.milestones.map(({ title, dueAt, status }) => ({
          title,
          dueAt,
          status,
        })),
        blockers,
        activity: recentActivity.map(({ source, occurredAt }) => ({ source, occurredAt })),
        integrations: integrations.map(({ provider, status }) => ({ provider, status })),
      }),
      signal: controller.signal,
    })
      .then((result) => {
        setHealthScore(result);
        setHealthScoreError(false);
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === "AbortError")) {
          setHealthScoreError(true);
        }
      });

    return () => controller.abort();
  }, [blockers, integrations, project.milestones, recentActivity]);

  const githubActivity = recentActivity.filter((item) => item.source === "github");
  const timeline = project.milestones.map((milestone) => ({
    label: milestone.title,
    date: formatShortDate(milestone.dueAt),
    state: toTimelineState(milestone.status),
  }));
  const nextDeadline = upcomingDeadlines[0];
  const isOverdue = nextDeadline ? daysUntil(nextDeadline.dueAt) < 0 : false;
  const milestones = project.milestones;
  const completedCount = milestones.filter((m) => m.status === "completed").length;
  const progressPercent = milestones.length === 0 ? 0 : Math.round((completedCount / milestones.length) * 100);
  const currentIndex = milestones.findIndex((m) => m.status !== "completed");
  const currentMilestone = milestones[currentIndex];

  const metrics: { label: string; value: string; note: string; tone?: "green" | "amber" | "red" | "gray" }[] = [
    {
      label: "Overall health",
      value: healthScore?.score == null ? "— / 100" : `${healthScore.score} / 100`,
      note: healthScoreError
        ? "Health score is currently unavailable"
        : healthScore
          ? "Calculated from current project data"
          : "Calculating from current project data…",
      tone: statusToColor(healthStatus),
    },
    {
      label: "Plan progress",
      value: `${progressPercent}%`,
      note: `${completedCount} of ${milestones.length} milestones complete`,
    },
    {
      label: "Current milestone",
      value: currentMilestone ? `${currentIndex + 1} / ${milestones.length}` : "All complete",
      note: currentMilestone
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
          <>
            <Button icon="calendar-15-gray">Oct 1 – Oct 8</Button>
            <Button variant="primary" icon="activity-15-white">
              Sync now
            </Button>
          </>
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
            <div className={styles.currentProgress}>
              <div className={styles.currentProgressLabel}>
                <p>Beta checkout progress</p>
                <p className={styles.currentProgressValue}>67%</p>
              </div>
              <ProgressBar filled={7} />
              <p className={styles.currentProgressNote}>3 deliverables remaining · 1 blocked</p>
            </div>
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
                <p className={styles.bodySmall}>
                  3 deliverables remain. Reservation edge cases and image-storage limits are the main schedule
                  risks.
                </p>
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
            {contributors.map((person) => (
              <div key={person.name} className={styles.contributor}>
                <Avatar initials={person.initials} tone={person.tone} />
                <div className={styles.contributorCopy}>
                  <p className={styles.contributorName}>{person.name}</p>
                  <p className={styles.contributorMeta}>{person.meta}</p>
                </div>
              </div>
            ))}
          </Card>

          <Card tone="blue">
            <SectionHeader
              title="Suggested next steps"
              description="Prioritized to protect the Oct 18 milestone"
            />
            <div className={styles.divider} />
            {nextSteps.map((step, i) => (
              <div key={step} className={styles.nextStep}>
                <span className={styles.stepNumber}>{i + 1}</span>
                <p>{step}</p>
              </div>
            ))}
          </Card>
        </div >
      </div >
    </AppShell >
  );
}
