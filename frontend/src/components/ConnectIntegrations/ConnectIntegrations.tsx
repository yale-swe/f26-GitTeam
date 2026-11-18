"use client";

import ActivityRow from "@/components/ActivityRow/ActivityRow";
import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import DiscordChannelPicker from "@/components/DiscordChannelPicker/DiscordChannelPicker";
import Icon, { type IconName } from "@/components/Icon/Icon";
import PageHeader from "@/components/PageHeader/PageHeader";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import SetupStepper from "@/components/SetupStepper/SetupStepper";
import StatusPill from "@/components/StatusPill/StatusPill";
import { useProjectDraft } from "@/lib/useProjectDraft";
import styles from "./ConnectIntegrations.module.css";

function SelectionOption({
  name,
  meta,
  selected,
  icon,
  selectedIcon,
  onToggle,
}: {
  name: string;
  meta: string;
  selected: boolean;
  icon: IconName;
  selectedIcon: IconName;
  onToggle?: () => void;
}) {
  const content = (
    <>
      <span className={styles.sourceIcon}>
        <Icon name={selected ? selectedIcon : icon} />
      </span>
      <div className={styles.optionCopy}>
        <p className={styles.optionName}>{name}</p>
        <p className={styles.optionMeta}>{meta}</p>
      </div>
      <span className={`${styles.radio} ${selected ? styles.radioSelected : ""}`}>
        {selected && <span className={styles.radioDot} />}
      </span>
    </>
  );

  const className = `${styles.option} ${selected ? styles.optionSelected : ""}`;

  if (onToggle) {
    return (
      <button
        type="button"
        className={className}
        onClick={onToggle}
        aria-pressed={selected}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

export default function ConnectIntegrations() {
  const { draft, updateDraft, hydrated } = useProjectDraft();

  return (
    <AppShell activeNav="projects" showProjectContext={false}>
      <PageHeader
        eyebrow="New project"
        title="Connect team activity"
        description="Link the places where work happens so DevSync can interpret progress against your plan."
        backHref="/projects/new"
        backLabel="Back to project plan"
        actions={
          <Button variant="ghost" href="/projects/new/review">
            Set up later
          </Button>
        }
      />

      <SetupStepper current={3} />

      <div className={styles.statusRow}>
        <div className={styles.statusCard}>
          <span className={`${styles.statusIcon} ${styles.statusIconDark}`}>
            <Icon name="github-16-white" />
          </span>
          <div className={styles.statusCopy}>
            <p className={styles.statusName}>GitHub</p>
            <p className={styles.statusMeta}>
              {draft.connectGitHub
                ? "Connects after the project is created"
                : "Optional. Connect a repository after the project is created"}
            </p>
          </div>
          <StatusPill tone={draft.connectGitHub ? "green" : "gray"} dot>
            {draft.connectGitHub ? "Selected" : "Not connected"}
          </StatusPill>
        </div>
        <div className={styles.statusCard}>
          <span className={styles.statusIcon}>
            <Icon name="hash-16-dark" />
          </span>
          <div className={styles.statusCopy}>
            <p className={styles.statusName}>Discord</p>
            <p className={styles.statusMeta}>
              {draft.discordChannels.length > 0
                ? `${draft.discordChannels.length} channel${draft.discordChannels.length === 1 ? "" : "s"} selected`
                : "Select the channel DevSync should read"}
            </p>
          </div>
          <StatusPill tone={draft.discordChannels.length > 0 ? "green" : "gray"} dot>
            {draft.discordChannels.length > 0 ? "Selected" : "Not connected"}
          </StatusPill>
        </div>
      </div>

      <div className={styles.workspace}>
        <div className={styles.mainColumn}>
          <Card>
            <SectionHeader
              title="Connect a GitHub repository"
              description="GitHub asks you to install DevSync after the project is created. You choose the repository there."
            />
            <SelectionOption
              name="Connect GitHub"
              meta="Install the DevSync GitHub App and import commits and pull requests"
              selected={hydrated && draft.connectGitHub}
              icon="github-16-gray"
              selectedIcon="github-16-blue"
              onToggle={() => updateDraft({ connectGitHub: !draft.connectGitHub })}
            />
          </Card>

          <Card>
            <SectionHeader
              title="Choose a Discord channel"
              description="Select the project channel with decisions, blockers, and coordination context."
            />
            <DiscordChannelPicker
              selectedChannelId={hydrated ? draft.discordChannels[0]?.channelId : null}
              onSelect={(selection) =>
                updateDraft({ discordChannels: selection ? [selection] : [] })
              }
            />
          </Card>
        </div>

        <div className={styles.sideColumn}>
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
              <p>
                Messages in {draft.discordChannels.length} selected channel
                {draft.discordChannels.length === 1 ? "" : "s"}
              </p>
            </div>
          </Card>

          <Card tone="muted">
            <SectionHeader title="What happens next" description="After you connect sources" />
            <ActivityRow
              compact
              icon="activity-14-gray"
              title="DevSync imports recent activity"
              meta="Pulled from the channels you selected"
            />
            <ActivityRow
              compact
              icon="message-square-14-gray"
              title="Discussion is matched to your plan"
              meta="Decisions and blockers surface on the dashboard"
            />
          </Card>

          <Button variant="primary" icon="arrow-right-15-white" href="/projects/new/review" fullWidth>
            Continue to review
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
