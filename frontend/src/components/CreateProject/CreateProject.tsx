import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import Checkbox from "@/components/Checkbox/Checkbox";
import Field from "@/components/Field/Field";
import Icon from "@/components/Icon/Icon";
import PageHeader from "@/components/PageHeader/PageHeader";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import SetupStepper from "@/components/SetupStepper/SetupStepper";
import StatusPill from "@/components/StatusPill/StatusPill";
import styles from "./CreateProject.module.css";

const features = [
  {
    title: "Campus-authenticated accounts",
    detail: "Email verification, profile, and campus affiliation",
    owner: "Jamie Kim",
  },
  {
    title: "Listing and search",
    detail: "Create listings, image upload, category and keyword filters",
    owner: "Sam Rivera",
  },
  {
    title: "Checkout and handoff",
    detail: "Reserve an item and coordinate a safe on-campus exchange",
    owner: "Alex Morgan",
  },
];

const milestones = [
  { title: "M1 · Core marketplace", detail: "Auth, listing creation, browse grid", date: "Oct 10" },
  {
    title: "M2 · Beta checkout",
    detail: "Reservation flow, seller notifications, exchange details",
    date: "Oct 18",
  },
  { title: "M3 · Final release", detail: "QA, accessibility, deployment, project report", date: "Oct 31" },
];

const qualityChecks = [
  { label: "Outcome is clear", done: true },
  { label: "3 major features defined", done: true },
  { label: "Milestones have target dates", done: true },
  { label: "Every deliverable has an owner", done: false, note: "2 deliverables still unassigned" },
];

export default function CreateProject() {
  return (
    <AppShell activeNav="projects" showProjectContext={false}>
      <PageHeader
        eyebrow="New project"
        title="Create your project plan"
        description="Turn a clear project brief into milestones your team can coordinate around."
        showBack
        actions={<Button>Save draft</Button>}
      />

      <SetupStepper current={2} />

      <div className={styles.workspace}>
        <div className={styles.mainColumn}>
          <Card>
            <SectionHeader
              title="Project summary"
              description="Give the team enough context to understand the outcome and scope."
            />
            <Field label="Project name" value="Campus Cart" />
            <Field
              label="What are you building?"
              value="A web marketplace where students can list, discover, and purchase used textbooks and dorm essentials from verified campus peers."
              multiline
              hint="Keep this outcome-focused. You can add technical context below."
            />
            <div className={styles.detailsRow}>
              <Field label="Target deadline" value="October 31, 2026" className={styles.deadlineField} />
              <Field label="Project owner" value="Alex Morgan" className={styles.growField} />
              <Field label="Team" value="CS 424 · Team 7" className={styles.growField} />
            </div>
          </Card>

          <Card>
            <SectionHeader
              title="Major features"
              description="These become the high-level scope used to interpret GitHub activity."
              action="+ Add feature"
            />
            {features.map((feature) => (
              <div key={feature.title} className={styles.feature}>
                <span className={styles.dragHandle}>⋮⋮</span>
                <div className={styles.featureCopy}>
                  <p className={styles.featureTitle}>{feature.title}</p>
                  <p className={styles.featureDetail}>{feature.detail}</p>
                </div>
                <StatusPill>{feature.owner}</StatusPill>
                <Icon name="more-horizontal-16-gray" />
              </div>
            ))}
          </Card>

          <Card>
            <SectionHeader
              title="Milestones and deliverables"
              description="Define concrete checkpoints. Each milestone can contain multiple deliverables."
              action="+ Add milestone"
            />
            {milestones.map((milestone) => (
              <div key={milestone.title} className={styles.milestone}>
                <span className={styles.milestoneMarker}>
                  <Icon name="milestone-13-blue" />
                </span>
                <div className={styles.milestoneCopy}>
                  <p className={styles.featureTitle}>{milestone.title}</p>
                  <p className={styles.featureDetail}>{milestone.detail}</p>
                </div>
                <div className={styles.milestoneDate}>
                  <Icon name="calendar-14-gray" />
                  <p>{milestone.date}</p>
                </div>
              </div>
            ))}
          </Card>

          <div className={styles.formActions}>
            <p className={styles.draftNote}>Draft saved just now</p>
            <div className={styles.actionButtons}>
              <Button>Back</Button>
              <Button variant="primary" icon="arrow-right-15-white">
                Continue to integrations
              </Button>
            </div>
          </div>
        </div>

        <div className={styles.sideColumn}>
          <Card tone="blue">
            <span className={styles.importIcon}>
              <Icon name="upload-16-blue" />
            </span>
            <div className={styles.importCopy}>
              <p className={styles.importTitle}>Already have a specification?</p>
              <p className={styles.bodySmall}>
                Import a proposal, requirements document, or README. DevSync will extract the plan for
                review.
              </p>
            </div>
            <Button icon="file-text-15-gray" fullWidth>
              Import specification
            </Button>
            <p className={styles.fileTypes}>PDF, DOCX, Markdown · up to 10 MB</p>
          </Card>

          <Card>
            <SectionHeader title="Plan quality" description="Your plan is detailed enough to connect activity." />
            <div className={styles.divider} />
            {qualityChecks.map((check) => (
              <div key={check.label} className={styles.checkItem}>
                <Checkbox checked={check.done} />
                <div className={styles.checkCopy}>
                  <p className={check.done ? styles.checkDone : styles.checkLabel}>{check.label}</p>
                  {check.note && <p className={styles.checkNote}>{check.note}</p>}
                </div>
              </div>
            ))}
          </Card>

          <Card>
            <SectionHeader title="How DevSync uses this" />
            <p className={styles.bodySmall}>
              The plan becomes the reference point for project health. Repository work and Discord context
              are mapped back to features, milestones, owners, and deadlines.
            </p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
