import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import Field from "@/components/Field/Field";
import Icon from "@/components/Icon/Icon";
import PageHeader from "@/components/PageHeader/PageHeader";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import SetupStepper from "@/components/SetupStepper/SetupStepper";
import StatusPill from "@/components/StatusPill/StatusPill";
import styles from "./SpecImportReview.module.css";

const features = [
  {
    title: "Verified student accounts",
    detail: "Sign up with a university email, create a profile, and show campus affiliation.",
    owner: "Jamie Kim",
    needsReview: false,
  },
  {
    title: "Listings and discovery",
    detail: "Create listings with photos, condition, price, category, and searchable tags.",
    owner: "Sam Rivera",
    needsReview: false,
  },
  {
    title: "Reservation and exchange",
    detail: "Reserve an item, notify the seller, and coordinate an on-campus handoff.",
    owner: "Alex Morgan",
    needsReview: true,
  },
  {
    title: "Moderation and reports",
    detail: "Report suspicious listings and provide a basic moderation queue.",
    owner: "Unassigned",
    needsReview: true,
  },
];

const milestones = [
  {
    title: "Core marketplace",
    detail: "Authentication, listing creation, browse and search",
    date: "Oct 10",
    needsReview: false,
  },
  {
    title: "Beta checkout",
    detail: "Reservation flow, seller notification, exchange details",
    date: "Oct 18",
    needsReview: false,
  },
  {
    title: "Final release",
    detail: "QA, accessibility checks, deployment, final report",
    date: "Oct 31",
    needsReview: true,
  },
];

const qualityMetrics = [
  { label: "Summary", value: "96%", tone: "green" as const },
  { label: "Feature scope", value: "88%", tone: "green" as const },
  { label: "Owners", value: "72%", tone: "amber" as const },
  { label: "Dates", value: "84%", tone: "green" as const },
];

function ConfidencePill({ needsReview }: { needsReview: boolean }) {
  return needsReview ? (
    <StatusPill tone="amber" dot>
      Review needed
    </StatusPill>
  ) : (
    <StatusPill tone="green" dot>
      High confidence
    </StatusPill>
  );
}

export default function SpecImportReview() {
  return (
    <AppShell activeNav="projects" showProjectContext={false}>
      <PageHeader
        eyebrow="Specification import"
        title="Review the extracted plan"
        description="Confirm the details DevSync found before connecting team activity."
        showBack
        actions={<Button icon="upload-15-gray">Replace file</Button>}
      />

      <SetupStepper current={2} />

      <div className={styles.uploadedFile}>
        <span className={styles.fileIcon}>
          <Icon name="file-text-16-blue" />
        </span>
        <div className={styles.fileDetails}>
          <p className={styles.fileName}>Campus Cart — Project Proposal.pdf</p>
          <p className={styles.fileMeta}>12 pages · 1.8 MB · uploaded by Alex Morgan</p>
        </div>
        <StatusPill tone="green" dot>
          Extraction complete
        </StatusPill>
      </div>

      <div className={styles.workspace}>
        <div className={styles.mainColumn}>
          <Card>
            <SectionHeader
              title="Project summary"
              description="Extracted from Executive Summary and Problem Statement"
              action="Edit section"
            />
            <Field label="Project name" value="Campus Cart" />
            <Field
              label="Summary"
              value="Campus Cart is a campus-only marketplace that helps students buy and sell used textbooks and dorm essentials, reducing cost and waste while improving trust through university email verification."
              multiline
            />
            <div className={styles.pillRow}>
              <StatusPill tone="blue">Deadline · Oct 31, 2026</StatusPill>
              <StatusPill>Team · 4 students</StatusPill>
              <StatusPill tone="green" dot>
                High confidence
              </StatusPill>
            </div>
          </Card>

          <Card>
            <SectionHeader
              title="Features"
              description="4 feature groups found · review highlighted language before continuing"
              action="+ Add feature"
            />
            {features.map((feature) => (
              <div
                key={feature.title}
                className={`${styles.feature} ${feature.needsReview ? styles.featureReview : ""}`}
              >
                <div className={styles.featureHeading}>
                  <p className={styles.featureTitle}>{feature.title}</p>
                  <ConfidencePill needsReview={feature.needsReview} />
                </div>
                <p className={styles.featureDetail}>{feature.detail}</p>
                <div className={styles.featureMeta}>
                  <StatusPill>Owner · {feature.owner}</StatusPill>
                  <div className={styles.edit}>
                    <Icon name="edit-13-blue" />
                    <p>Edit</p>
                  </div>
                </div>
              </div>
            ))}
          </Card>

          <Card>
            <SectionHeader
              title="Milestones and deadlines"
              description="Dates normalized from the proposed 8-week schedule"
              action="Edit dates"
            />
            {milestones.map((milestone, i) => (
              <div key={milestone.title} className={styles.milestone}>
                <span className={styles.milestoneMarker}>{i + 1}</span>
                <div className={styles.milestoneContent}>
                  <div className={styles.milestoneTitleRow}>
                    <p className={styles.featureTitle}>{milestone.title}</p>
                    <ConfidencePill needsReview={milestone.needsReview} />
                  </div>
                  <p className={styles.featureDetail}>{milestone.detail}</p>
                </div>
                <div className={styles.milestoneDate}>
                  <p className={styles.dateLabel}>Target</p>
                  <p className={milestone.needsReview ? styles.dateWarning : undefined}>{milestone.date}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>

        <div className={styles.sideColumn}>
          <Card tone="muted">
            <SectionHeader title="Extraction quality" description="8 of 10 fields are ready" />
            <div className={styles.divider} />
            {qualityMetrics.map((metric) => (
              <div key={metric.label} className={styles.metric}>
                <p>{metric.label}</p>
                <StatusPill tone={metric.tone}>{metric.value}</StatusPill>
              </div>
            ))}
          </Card>

          <Card tone="amber">
            <div className={styles.reviewCue}>
              <Icon name="alert-triangle-16-amber" />
              <p>2 items need review</p>
            </div>
            <p className={styles.bodySmall}>
              Confirm whether messaging is in scope and assign an owner to moderation. The final deadline
              was inferred from “end of October.”
            </p>
          </Card>

          <Card>
            <SectionHeader title="Ready to continue?" />
            <p className={styles.bodySmall}>
              You can edit any imported detail later. Approval creates the initial plan and preserves the
              source document.
            </p>
            <Button variant="primary" icon="arrow-right-15-white" fullWidth>
              Approve and continue
            </Button>
            <Button fullWidth>Save as draft</Button>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
