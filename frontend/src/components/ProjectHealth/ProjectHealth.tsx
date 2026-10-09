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
import { toTimelineState, formatShortDate, statusToColor, healthToText } from "@/lib/dashboardFormat";
import type { Dashboard } from "@/lib/types";
import styles from "./ProjectHealth.module.css";

const evidence: { label: string; dot: IconName }[] = [
  { label: "14 commits since Monday", dot: "dot-7-green" },
  { label: "2 unresolved blockers", dot: "dot-7-amber" },
  { label: "1 scope decision this week", dot: "dot-7-blue" },
];

const metrics: { label: string; value: string; note: string; tone?: "green" | "amber" }[] = [
  { label: "Overall health", value: "74 / 100", note: "Down 4 points since Monday", tone: "amber" },
  { label: "Plan progress", value: "68%", note: "17 of 25 deliverables complete", tone: "green" },
  { label: "Current milestone", value: "6 / 9", note: "Beta checkout · due in 10 days" },
  { label: "Recent change", value: "+9%", note: "Progress gained in the last 7 days", tone: "green" },
];

const pullRequests: {
  title: string;
  meta: string;
  status: string;
  tone: "amber" | "green" | "gray";
}[] = [
    {
      title: "feat: add listing image upload and preview",
      meta: "Sam Rivera · PR #48 · 3 hours ago",
      status: "Changes requested",
      tone: "amber",
    },
    {
      title: "fix: validate campus email domain",
      meta: "Jamie Kim · PR #46 · merged yesterday",
      status: "Merged",
      tone: "green",
    },
    {
      title: "feat: seller reservation notifications",
      meta: "Alex Morgan · PR #45 · updated yesterday",
      status: "In review",
      tone: "gray",
    },
    {
      title: "test: add checkout reservation edge cases",
      meta: "Taylor Ng · PR #43 · merged 2 days ago",
      status: "Merged",
      tone: "green",
    },
  ];

const featureWork = [
  { name: "Listings and discovery", segments: 9, meta: "12 commits · 2 PRs", value: "82%" },
  { name: "Reservation and exchange", segments: 7, meta: "9 commits · 2 PRs", value: "61%" },
  { name: "Verified accounts", segments: 9, meta: "4 commits · 1 PR", value: "90%" },
  { name: "Moderation and reports", segments: 3, meta: "No activity this week", value: "25%" },
];

const discordContext: {
  type: "Blocker" | "Decision";
  title: string;
  detail: string;
  owner?: string;
}[] = [
    {
      type: "Blocker",
      title: "Free image-storage quota may be too small",
      detail: "Team is comparing Cloudinary and Supabase limits before finishing upload work.",
      owner: "Sam Rivera",
    },
    {
      type: "Blocker",
      title: "Reservation expiry behavior is unresolved",
      detail: "Product needs to define what happens after a seller does not respond for 24 hours.",
      owner: "Alex Morgan",
    },
    {
      type: "Decision",
      title: "Use campus email verification for beta",
      detail: "The team deferred student-ID upload until after course delivery.",
    },
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
  const { project, nextSteps, latestSummary, overallHealth } = dashboard;
  const timeline = project.milestones.map((milestone) => ({
    label: milestone.title,
    date: formatShortDate(milestone.dueAt),
    state: toTimelineState(milestone.status),
  }));
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
          <StatusPill tone={statusToColor(overallHealth)} dot>
            {healthToText(overallHealth)}
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
              description="Activity mapped to features and milestones"
              action="Open repository ↗"
            />
            {pullRequests.map((pr) => (
              <ActivityRow
                key={pr.title}
                icon="git-pull-request-15-gray"
                title={pr.title}
                meta={pr.meta}
                trailing={<StatusPill tone={pr.tone}>{pr.status}</StatusPill>}
              />
            ))}
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
            <SectionHeader title="Upcoming deadline" description="Beta checkout · Oct 18" />
            <div className={styles.countdown}>
              <p className={styles.countdownValue}>10 days</p>
              <StatusPill tone="amber" dot>
                At risk
              </StatusPill>
            </div>
            <p className={styles.bodySmall}>
              3 deliverables remain. Reservation edge cases and image-storage limits are the main schedule
              risks.
            </p>
          </Card>

          <Card>
            <SectionHeader
              title="Blockers and decisions"
              description="Summarized from selected Discord channels"
              action="View context"
            />
            {discordContext.map((item) => {
              const isBlocker = item.type === "Blocker";
              return (
                <div
                  key={item.title}
                  className={`${styles.contextItem} ${isBlocker ? styles.contextBlocker : ""}`}
                >
                  <div className={styles.contextType}>
                    <StatusPill tone={isBlocker ? "amber" : "blue"}>{item.type}</StatusPill>
                    <p className={styles.channel}>#campus-cart-dev</p>
                  </div>
                  <p className={styles.contextTitle}>{item.title}</p>
                  <p className={styles.contextDetail}>{item.detail}</p>
                  {item.owner && <p className={styles.contextOwner}>Owner · {item.owner}</p>}
                </div>
              );
            })}
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
        </div>
      </div>
    </AppShell >
  );
}
