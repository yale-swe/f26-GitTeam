"use client";

import Link from "next/link";
import ActivityRow from "@/components/ActivityRow/ActivityRow";
import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import FeatureChecklist from "@/components/FeatureChecklist/FeatureChecklist";
import Icon, { type IconName } from "@/components/Icon/Icon";
import PageHeader from "@/components/PageHeader/PageHeader";
import type { ProjectOption } from "@/components/Sidebar/Sidebar";
import ProgressBar from "@/components/ProgressBar/ProgressBar";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import StatusPill from "@/components/StatusPill/StatusPill";
import {
  daysUntil,
  dueText,
  formatExecutiveSummary,
  formatShortDate,
  healthToText,
  integrationLimitations,
  plural,
  statusToColor,
  timeAgo,
  toTimelineState,
} from "@/lib/dashboardFormat";
import type { AnalysisEvidence, Dashboard } from "@/lib/types";
import styles from "./ProjectHealth.module.css";

const evidenceTypeLabels: Record<AnalysisEvidence["evidenceType"], string> = {
  project: "Project plan",
  milestone: "Milestone",
  deliverable: "Deliverable",
  integration: "Integration",
  activity: "Project activity",
};

function evidenceSourceLabel(evidence: AnalysisEvidence) {
  if (evidence.source === "github") return "GitHub";
  if (evidence.source === "discord") return "Discord";
  return evidenceTypeLabels[evidence.evidenceType];
}

function evidenceMetadata(evidence: AnalysisEvidence) {
  const status = evidence.status
    ? evidence.status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
    : null;
  const date = evidence.occurredAt
    ? timeAgo(evidence.occurredAt)
    : evidence.dueAt
      ? dueText(evidence.dueAt)
      : null;

  return [status, date].filter(Boolean).join(" · ");
}

type ProjectHealthProps = {
  dashboard: Dashboard;
  /** Projects offered by the sidebar switcher. */
  projects?: ProjectOption[];
  onGenerateSummary?: () => void;
  isGenerating?: boolean;
  summaryError?: string | null;
  onSync?: () => void;
  onConnectGitHub?: () => void;
  isSyncing?: boolean;
  githubError?: string | null;
  discordError?: string | null;
};

export default function ProjectHealth({
  dashboard,
  projects,
  onGenerateSummary,
  isGenerating = false,
  summaryError = null,
  onSync,
  onConnectGitHub,
  isSyncing = false,
  githubError = null,
  discordError = null,
}: ProjectHealthProps) {
  const { project, healthScore, overallHealth, integrations, nextStepDetails, latestSummary, upcomingDeadlines, blockerDetails, recentActivity, analysisStatus } = dashboard;
  const healthStatus = overallHealth;
  const analysisIsStale = analysisStatus === "stale";
  const dataLimitations = integrationLimitations(integrations);

  const githubConnected = integrations.some((item) => item.provider === "github");
  const githubActivity = recentActivity.filter((item) => item.source === "github");
  const discordActivity = recentActivity.filter((item) => item.source === "discord");
  const evidence: { label: string; dot: IconName }[] = [
    { label: plural(githubActivity.length, "GitHub update"), dot: "dot-7-green" },
    { label: plural(discordActivity.length, "Discord message"), dot: "dot-7-green" },
    { label: plural(blockerDetails.length, "unresolved blocker"), dot: "dot-7-amber" },
  ];
  const timeline = project.milestones.map((milestone) => ({
    id: milestone.id,
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
      note: healthScore == null
        ? "Not enough data to calculate yet"
        : analysisIsStale
          ? "Uses last known blockers; refresh summary"
          : "Calculated from current project data",
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
    <AppShell
      activeNav="health"
      projectId={project.id}
      projectName={project.name}
      projects={projects}
      integrations={integrations}
    >
      <PageHeader
        eyebrow={project.name}
        title="Project health"
        description="Where the project stands based on the plan, GitHub work, and Discord context."
        actions={
          githubConnected ? (
            <Button variant="primary" icon="activity-15-white" onClick={onSync} disabled={isSyncing}>
              {isSyncing ? "Syncing…" : "Sync now"}
            </Button>
          ) : (
            <Button variant="primary" icon="github-16-white" onClick={onConnectGitHub}>
              Connect GitHub
            </Button>
          )
        }
      />
      {githubError && (
        <p className={styles.summaryError} role="alert">
          {githubError}
        </p>
      )}
      {discordError && (
        <p className={styles.summaryError} role="alert">
          {discordError}
        </p>
      )}

      <Card className={styles.executiveSummary}>
        <div className={styles.summaryHeading}>
          <div className={styles.question}>
            <p className={styles.overline}>Executive summary</p>
            <p className={styles.questionTitle}>Where does the project stand?</p>
          </div>
          <div className={styles.summaryControls}>
            <StatusPill tone={statusToColor(healthStatus)} dot>
              {healthToText(healthStatus)}
            </StatusPill>
            {onGenerateSummary && (
              <Button onClick={onGenerateSummary} disabled={isGenerating}>
                {isGenerating
                  ? "Generating…"
                  : latestSummary
                    ? "Refresh summary"
                    : "Generate summary"}
              </Button>
            )}
          </div>
        </div>
        <p className={styles.summaryBody}>
          {latestSummary
            ? formatExecutiveSummary(latestSummary.text)
            : "No summary has been generated yet."}
        </p>
        {dataLimitations.length > 0 && (
          <div className={styles.summaryLimitations} role="status">
            <p className={styles.limitationsTitle}>Data limitations</p>
            <ul className={styles.limitationsList}>
              {dataLimitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </div>
        )}
        {analysisIsStale && dataLimitations.length === 0 && (
          <p className={styles.summaryStale} role="status">
            Analysis is out of date after newer project data. Last known blockers and next steps
            remain visible until the summary is refreshed.
          </p>
        )}
        {summaryError && (
          <p className={styles.summaryError} role="alert">
            {summaryError}
          </p>
        )}
        <div className={styles.summaryFooter}>
          {latestSummary && (
            <p className={styles.summaryTimestamp}>
              Generated {timeAgo(latestSummary.generatedAt)}
            </p>
          )}
          <div className={styles.evidenceRow}>
            {evidence.map((item) => (
              <div key={item.label} className={styles.evidence}>
                <Icon name={item.dot} />
                <p>{item.label}</p>
              </div>
            ))}
          </div>
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
              actionHref={`/milestones?project=${project.id}`}
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
                        <Link href={`/milestones/${item.id}?project=${project.id}`}>
                          {item.label}
                        </Link>
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
              title="Recent Discord messages"
              description="Latest messages from the connected channel"
            />
            {discordActivity.length === 0 ? (
              <p className={styles.bodySmall}>No recent Discord messages.</p>
            ) : (
              discordActivity.map((item) => (
                <ActivityRow
                  key={item.id}
                  icon="message-square-16-gray"
                  title={item.title}
                  meta={`Discord · ${timeAgo(item.occurredAt)}`}
                />
              ))
            )}
          </Card>

          <Card>
            <SectionHeader
              title="Work by feature"
              description="Mark features as done as the team finishes them."
            />
            <FeatureChecklist
              key={project.id}
              projectId={project.id}
              features={project.features}
              completedFeatures={project.completedFeatures}
              suggestions={dashboard.featureSuggestions}
            />
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
                {blockerDetails.length > 0 && (
                  <p className={styles.bodySmall}>
                    {plural(blockerDetails.length, "open blocker")} could affect this deadline
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
              description="Supported by the project plan and synchronized activity"
            />
            {blockerDetails.length === 0 ? (
              <p className={styles.bodySmall}>
                {analysisStatus === "unavailable"
                  ? "No blocker analysis is available yet."
                  : "No supported blockers found."}
              </p>
            ) : (
              blockerDetails.map((blocker) => (
                <article key={blocker.text} className={`${styles.contextItem} ${styles.contextBlocker}`}>
                  <div className={styles.contextType}>
                    <StatusPill tone="amber">Blocker</StatusPill>
                    <span className={styles.channel}>
                      {blocker.evidence.length === 1
                        ? evidenceSourceLabel(blocker.evidence[0])
                        : plural(blocker.evidence.length, "source")}
                    </span>
                  </div>
                  <p className={styles.contextTitle}>{blocker.text}</p>
                  <div className={styles.claimEvidenceList}>
                    {blocker.evidence.map((item) => {
                      const metadata = evidenceMetadata(item);
                      return (
                        <div key={item.evidenceId} className={styles.claimEvidence}>
                          <p className={styles.contextDetail}>
                            <span className={styles.contextDetailLabel}>Based on:</span> {item.title}
                          </p>
                          {(metadata || item.url) && (
                            <div className={styles.claimEvidenceMeta}>
                              {metadata && <span>{metadata}</span>}
                              {item.url && (
                                <a
                                  className={styles.contextLink}
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  View source
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>
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
              description="Recommended actions supported by current project evidence"
            />
            <div className={styles.divider} />
            {nextStepDetails.length === 0 ? (
              <p className={styles.bodySmall}>
                {analysisStatus === "unavailable"
                  ? "No next-step analysis is available yet."
                  : "No supported next steps found."}
              </p>
            ) : (
              nextStepDetails.map((step, i) => (
                <article key={step.text} className={styles.nextStep}>
                  <span className={styles.stepNumber}>{i + 1}</span>
                  <div className={styles.nextStepContent}>
                    <p className={styles.nextStepTitle}>{step.text}</p>
                    <div className={styles.claimEvidenceList}>
                      {step.evidence.map((item) => {
                        const details = [evidenceSourceLabel(item), evidenceMetadata(item)]
                          .filter(Boolean)
                          .join(" · ");
                        return (
                          <div key={item.evidenceId} className={styles.claimEvidence}>
                            <p className={styles.contextDetail}>
                              <span className={styles.contextDetailLabel}>Based on:</span>{" "}
                              {item.title}
                            </p>
                            <div className={styles.claimEvidenceMeta}>
                              <span>{details}</span>
                              {item.url && (
                                <a
                                  className={styles.contextLink}
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  View source
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </article>
              ))
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
