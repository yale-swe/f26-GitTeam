import ActivityRow from "@/components/ActivityRow/ActivityRow";
import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import Icon, { type IconName } from "@/components/Icon/Icon";
import PageHeader from "@/components/PageHeader/PageHeader";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import SetupStepper from "@/components/SetupStepper/SetupStepper";
import StatusPill from "@/components/StatusPill/StatusPill";
import styles from "./ConnectIntegrations.module.css";

type Option = {
  name: string;
  meta: string;
  selected: boolean;
  tag?: { label: string; tone: "blue" | "gray" };
};

const repositories: Option[] = [
  {
    name: "cs424-team7/campus-cart",
    meta: "TypeScript · updated 18 minutes ago",
    selected: true,
    tag: { label: "Recommended", tone: "blue" },
  },
  {
    name: "cs424-team7/campus-cart-api",
    meta: "Node.js · updated yesterday",
    selected: false,
    tag: { label: "Private", tone: "gray" },
  },
  { name: "alexm-dev/campus-cart-prototype", meta: "JavaScript · updated 12 days ago", selected: false },
];

const channels: Option[] = [
  {
    name: "# campus-cart-dev",
    meta: "624 messages · active today",
    selected: true,
    tag: { label: "Primary", tone: "blue" },
  },
  { name: "# campus-cart-product", meta: "188 messages · active yesterday", selected: true },
  { name: "# team-7-general", meta: "1,420 messages · active today", selected: false },
  { name: "# cs424-help", meta: "Course-wide support channel", selected: false },
];

function SelectionOption({
  option,
  icon,
  selectedIcon,
}: {
  option: Option;
  icon: IconName;
  selectedIcon: IconName;
}) {
  return (
    <div className={`${styles.option} ${option.selected ? styles.optionSelected : ""}`}>
      <span className={styles.sourceIcon}>
        <Icon name={option.selected ? selectedIcon : icon} />
      </span>
      <div className={styles.optionCopy}>
        <p className={styles.optionName}>{option.name}</p>
        <p className={styles.optionMeta}>{option.meta}</p>
      </div>
      {option.tag && (
        <StatusPill tone={option.tag.tone}>{option.tag.label}</StatusPill>
      )}
      <span className={`${styles.radio} ${option.selected ? styles.radioSelected : ""}`}>
        {option.selected && <span className={styles.radioDot} />}
      </span>
    </div>
  );
}

export default function ConnectIntegrations() {
  return (
    <AppShell activeNav="projects" showProjectContext={false}>
      <PageHeader
        eyebrow="New project"
        title="Connect team activity"
        description="Link the places where work happens so DevSync can interpret progress against your plan."
        showBack
        actions={<Button variant="ghost">Set up later</Button>}
      />

      <SetupStepper current={3} />

      <div className={styles.statusRow}>
        <div className={styles.statusCard}>
          <span className={`${styles.statusIcon} ${styles.statusIconDark}`}>
            <Icon name="github-16-white" />
          </span>
          <div className={styles.statusCopy}>
            <p className={styles.statusName}>GitHub</p>
            <p className={styles.statusMeta}>Account connected as alexm-dev</p>
          </div>
          <StatusPill tone="green" dot>
            Connected
          </StatusPill>
        </div>
        <div className={styles.statusCard}>
          <span className={styles.statusIcon}>
            <Icon name="hash-16-dark" />
          </span>
          <div className={styles.statusCopy}>
            <p className={styles.statusName}>Discord</p>
            <p className={styles.statusMeta}>Campus Cart workspace authorized</p>
          </div>
          <StatusPill tone="green" dot>
            Connected
          </StatusPill>
        </div>
      </div>

      <div className={styles.workspace}>
        <div className={styles.mainColumn}>
          <Card>
            <SectionHeader
              title="Choose a GitHub repository"
              description="DevSync reads branches, issues, pull requests, commits, and contributors."
              action="Change account"
            />
            {repositories.map((repo) => (
              <SelectionOption
                key={repo.name}
                option={repo}
                icon="github-16-gray"
                selectedIcon="github-16-blue"
              />
            ))}
            <div className={styles.linkRow}>
              <Icon name="link-14-blue" />
              <p>Connect a different repository</p>
            </div>
          </Card>

          <Card>
            <SectionHeader
              title="Choose Discord channels"
              description="Select project channels with decisions, blockers, and coordination context."
              action="Manage access"
            />
            {channels.map((channel) => (
              <SelectionOption
                key={channel.name}
                option={channel}
                icon="hash-16-gray"
                selectedIcon="hash-16-blue"
              />
            ))}
          </Card>
        </div>

        <div className={styles.sideColumn}>
          <Card>
            <SectionHeader title="Imported data preview" description="From the selected sources" />
            <div className={styles.metrics}>
              <div className={styles.metric}>
                <p className={styles.metricValue}>4</p>
                <p className={styles.metricLabel}>Open PRs</p>
              </div>
              <div className={styles.metric}>
                <p className={styles.metricValue}>27</p>
                <p className={styles.metricLabel}>Recent commits</p>
              </div>
              <div className={styles.metric}>
                <p className={styles.metricValue}>143</p>
                <p className={styles.metricLabel}>Messages</p>
              </div>
            </div>
            <ActivityRow
              compact
              icon="git-pull-request-14-gray"
              title="feat: add listing image upload"
              meta="PR #48 · opened by Sam Rivera · 2 reviews"
            />
            <ActivityRow
              compact
              icon="activity-14-gray"
              title="27 commits in the last 7 days"
              meta="Most activity maps to Listing and search"
            />
            <ActivityRow
              compact
              icon="message-square-14-gray"
              title="Decision: use campus email verification"
              meta="#campus-cart-product · yesterday at 4:18 PM"
            />
            <ActivityRow
              compact
              warning
              icon="alert-triangle-14-amber"
              title="Blocker: image storage quota"
              meta="#campus-cart-dev · owner not assigned"
            />
          </Card>

          <Card tone="muted">
            <SectionHeader title="Permissions and privacy" />
            <p className={styles.bodySmall}>
              DevSync requests read-only access. It summarizes project signals and does not post messages,
              modify code, or read unselected Discord channels.
            </p>
            <div className={styles.divider} />
            <div className={styles.permission}>
              <Icon name="check-14-green" />
              <p>Repository metadata and activity</p>
            </div>
            <div className={styles.permission}>
              <Icon name="check-14-green" />
              <p>Messages in 2 selected channels</p>
            </div>
          </Card>

          <Button variant="primary" icon="arrow-right-15-white" fullWidth>
            Continue to review
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
