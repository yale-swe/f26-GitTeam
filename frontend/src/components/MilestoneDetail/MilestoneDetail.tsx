import ActivityRow from "@/components/ActivityRow/ActivityRow";
import AppShell from "@/components/AppShell/AppShell";
import Avatar from "@/components/Avatar/Avatar";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import Checkbox from "@/components/Checkbox/Checkbox";
import Icon from "@/components/Icon/Icon";
import PageHeader from "@/components/PageHeader/PageHeader";
import ProgressBar from "@/components/ProgressBar/ProgressBar";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import StatusPill from "@/components/StatusPill/StatusPill";
import styles from "./MilestoneDetail.module.css";

type DeliverableStatus = "Complete" | "In progress" | "Blocked";

const statusTones = { Complete: "green", "In progress": "blue", Blocked: "amber" } as const;

const deliverables: { title: string; detail: string; status: DeliverableStatus; owner: string }[] = [
  {
    title: "Create reservation from a listing",
    detail: "Buyer can reserve an available item and sees confirmation.",
    status: "Complete",
    owner: "Alex Morgan",
  },
  {
    title: "Notify seller of a new reservation",
    detail: "Seller receives an in-app and email notification.",
    status: "Complete",
    owner: "Jamie Kim",
  },
  {
    title: "Show pending and confirmed exchanges",
    detail: "Both users can see current reservation state and handoff details.",
    status: "In progress",
    owner: "Sam Rivera",
  },
  {
    title: "Define reservation expiry behavior",
    detail: "Choose timeout, buyer messaging, and seller override behavior.",
    status: "Blocked",
    owner: "Alex Morgan",
  },
  {
    title: "Add checkout edge-case tests",
    detail: "Cover duplicate reservations, cancellation, and stale inventory.",
    status: "In progress",
    owner: "Taylor Ng",
  },
];

const pullRequests: { title: string; meta: string; status: string; tone: "gray" | "green" | "amber" }[] = [
  {
    title: "#45 · feat: seller reservation notifications",
    meta: "Alex Morgan · updated yesterday · 6 files changed",
    status: "In review",
    tone: "gray",
  },
  {
    title: "#43 · test: checkout reservation edge cases",
    meta: "Taylor Ng · merged 2 days ago · 11 tests added",
    status: "Merged",
    tone: "green",
  },
  {
    title: "#41 · feat: create reservation endpoint",
    meta: "Sam Rivera · merged 4 days ago · milestone deliverable complete",
    status: "Merged",
    tone: "green",
  },
  {
    title: "#39 · ui: reservation confirmation state",
    meta: "Jamie Kim · updated 4 days ago · feedback pending",
    status: "Changes requested",
    tone: "amber",
  },
];

const commits = [
  { title: "9a2fc1b  handle duplicate reservation response", meta: "Taylor Ng · 3 hours ago" },
  { title: "4d8e730  add seller email template", meta: "Jamie Kim · yesterday" },
  { title: "12bc88a  persist exchange meeting details", meta: "Sam Rivera · yesterday" },
];

const quotes = [
  {
    author: "Jamie Kim · 10:42 AM",
    text: "“Email notifications are ready, but the copy needs the final expiry rule before we merge.”",
  },
  {
    author: "Sam Rivera · yesterday",
    text: "“I can finish the exchange state this week if we lock the timeout by Wednesday.”",
  },
];

const owners: { initials: string; name: string; role: string; tone: "dark" | "blue" | "light" }[] = [
  { initials: "AM", name: "Alex Morgan", role: "Milestone lead · 2 deliverables", tone: "dark" },
  { initials: "SR", name: "Sam Rivera", role: "Backend · 2 deliverables", tone: "blue" },
  { initials: "JK", name: "Jamie Kim", role: "Frontend · 1 deliverable", tone: "light" },
  { initials: "TN", name: "Taylor Ng", role: "QA · 1 deliverable", tone: "light" },
];

const nextActions = [
  { label: "Decide the reservation expiry rule", note: "Owner: Alex · today" },
  { label: "Review and merge PR #45", note: "Owner: Jamie · by tomorrow" },
  { label: "Pair on exchange-state edge cases", note: "Sam + Taylor · this week" },
];

export default function MilestoneDetail() {
  return (
    <AppShell activeNav="milestones">
      <PageHeader
        eyebrow="Campus Cart · Milestone 2 of 3"
        title="Beta checkout"
        description="Reservation, seller notification, and exchange coordination for the closed beta."
        showBack
        actions={
          <>
            <Button icon="edit-15-gray">Edit milestone</Button>
            <Button icon="more-horizontal-15-gray">More</Button>
          </>
        }
      />

      <div className={styles.summaryRow}>
        <div className={`${styles.summaryCard} ${styles.statusSummary}`}>
          <div className={styles.labelRow}>
            <p className={styles.summaryLabel}>Milestone status</p>
            <StatusPill tone="amber" dot>
              Needs attention
            </StatusPill>
          </div>
          <p className={styles.summaryValue}>67% complete</p>
          <ProgressBar filled={7} />
          <p className={styles.summaryNote}>6 of 9 deliverables done · 1 blocked</p>
        </div>
        <div className={`${styles.summaryCard} ${styles.fixedSummary}`}>
          <p className={styles.summaryLabel}>Target date</p>
          <p className={`${styles.summaryValue} ${styles.amber}`}>Oct 18, 2026</p>
          <p className={styles.summaryNote}>10 days remaining · date unchanged</p>
        </div>
        <div className={`${styles.summaryCard} ${styles.fixedSummary}`}>
          <p className={styles.summaryLabel}>Linked activity</p>
          <p className={`${styles.summaryValue} ${styles.wrapValue}`}>4 PRs · 19 commits</p>
          <p className={styles.summaryNote}>Last update 18 minutes ago</p>
        </div>
      </div>

      <div className={styles.workspace}>
        <div className={styles.mainColumn}>
          <Card>
            <SectionHeader
              title="Deliverables"
              description="Definition of done for this milestone"
              action="+ Add deliverable"
            />
            {deliverables.map((item) => (
              <div key={item.title} className={styles.deliverable}>
                <Checkbox
                  size={19}
                  checked={item.status === "Complete"}
                  warning={item.status === "Blocked"}
                />
                <div className={styles.deliverableCopy}>
                  <p className={styles.deliverableTitle}>{item.title}</p>
                  <p className={styles.deliverableDetail}>{item.detail}</p>
                </div>
                <div className={styles.ownership}>
                  <StatusPill tone={statusTones[item.status]}>{item.status}</StatusPill>
                  <p className={styles.ownerName}>{item.owner}</p>
                </div>
              </div>
            ))}
          </Card>

          <Card>
            <SectionHeader
              title="Linked pull requests"
              description="Automatically mapped from repository activity"
              action="View in GitHub ↗"
            />
            {pullRequests.map((pr) => (
              <ActivityRow
                key={pr.title}
                icon="git-pull-request-14-gray"
                title={pr.title}
                meta={pr.meta}
                trailing={<StatusPill tone={pr.tone}>{pr.status}</StatusPill>}
              />
            ))}
          </Card>

          <Card>
            <SectionHeader title="Recent commits" description="Commits linked to Beta checkout" />
            {commits.map((commit) => (
              <ActivityRow
                key={commit.title}
                mono
                icon="activity-14-gray"
                title={commit.title}
                meta={commit.meta}
              />
            ))}
          </Card>
        </div>

        <div className={styles.sideColumn}>
          <Card tone="amber">
            <SectionHeader title="Active blocker" description="Raised yesterday in #campus-cart-dev" />
            <div className={styles.blocker}>
              <Icon name="alert-triangle-16-amber" />
              <StatusPill tone="amber">Needs a decision</StatusPill>
            </div>
            <p className={styles.blockerQuestion}>
              What happens when a seller does not respond within 24 hours?
            </p>
            <p className={styles.bodySmall}>
              The API and UI work are waiting on product behavior for expiry, buyer notification, and
              relisting.
            </p>
            <div className={styles.blockerOwner}>
              <Avatar initials="AM" size={26} />
              <p>Alex Morgan · owner</p>
            </div>
          </Card>

          <Card>
            <SectionHeader
              title="Discord context"
              description="Relevant decisions and coordination"
              action="Open thread ↗"
            />
            {quotes.map((quote) => (
              <div key={quote.author} className={styles.quote}>
                <p>{quote.author}</p>
                <p className={styles.quoteText}>{quote.text}</p>
              </div>
            ))}
          </Card>

          <Card>
            <SectionHeader title="Owners" description="People accountable for this milestone" />
            {owners.map((owner) => (
              <div key={owner.name} className={styles.owner}>
                <Avatar initials={owner.initials} tone={owner.tone} />
                <div className={styles.ownerCopy}>
                  <p className={styles.ownerTitle}>{owner.name}</p>
                  <p className={styles.ownerRole}>{owner.role}</p>
                </div>
              </div>
            ))}
          </Card>

          <Card tone="blue">
            <SectionHeader title="Recommended next actions" />
            <div className={styles.divider} />
            {nextActions.map((action) => (
              <div key={action.label} className={styles.checkItem}>
                <Checkbox />
                <div className={styles.checkCopy}>
                  <p className={styles.checkLabel}>{action.label}</p>
                  <p className={styles.checkNote}>{action.note}</p>
                </div>
              </div>
            ))}
            <Button variant="primary" icon="plus-15-white" fullWidth>
              Create action items
            </Button>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
