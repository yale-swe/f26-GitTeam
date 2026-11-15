"use client";

import { useEffect, useState } from "react";

import ActivityRow from "@/components/ActivityRow/ActivityRow";
import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import Icon, { type IconName } from "@/components/Icon/Icon";
import PageHeader from "@/components/PageHeader/PageHeader";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import SetupStepper from "@/components/SetupStepper/SetupStepper";
import StatusPill from "@/components/StatusPill/StatusPill";
import { listDiscordChannels } from "@/lib/api";
import type { DiscordGuildOption } from "@/lib/types";
import type { DraftDiscordChannel } from "@/lib/projectDraft";
import { useProjectDraft } from "@/lib/useProjectDraft";
import styles from "./ConnectIntegrations.module.css";

type Option = {
  name: string;
  meta: string;
  selected: boolean;
  tag?: { label: string; tone: "blue" | "gray" };
};

// GitHub project routes do not exist yet, so this list stays a static preview.
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

function SelectionOption({
  name,
  meta,
  selected,
  icon,
  selectedIcon,
  tag,
  onToggle,
}: {
  name: string;
  meta: string;
  selected: boolean;
  icon: IconName;
  selectedIcon: IconName;
  tag?: { label: string; tone: "blue" | "gray" };
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
      {tag && <StatusPill tone={tag.tone}>{tag.label}</StatusPill>}
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
  const [guilds, setGuilds] = useState<DiscordGuildOption[] | null>(null);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);

  useEffect(() => {
    // Runs once on mount; initial state already is loading with no error.
    let active = true;
    listDiscordChannels()
      .then((data) => {
        if (active) setGuilds(data);
      })
      .catch(() => {
        if (active) setChannelsError("Discord channels couldn't be loaded. Try refreshing the page.");
      })
      .finally(() => {
        if (active) setLoadingChannels(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const isSelected = (channelId: string) =>
    draft.discordChannels.some((c) => c.channelId === channelId);

  const toggleChannel = (selection: DraftDiscordChannel) => {
    const already = isSelected(selection.channelId);
    updateDraft({
      discordChannels: already
        ? draft.discordChannels.filter((c) => c.channelId !== selection.channelId)
        : [...draft.discordChannels, selection],
    });
  };

  return (
    <AppShell activeNav="projects" showProjectContext={false}>
      <PageHeader
        eyebrow="New project"
        title="Connect team activity"
        description="Link the places where work happens so DevSync can interpret progress against your plan."
        showBack
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
            <p className={styles.statusMeta}>Connecting GitHub is coming soon</p>
          </div>
          <StatusPill tone="gray" dot>
            Not connected
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
                : "Select the channels DevSync should read"}
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
              title="Choose a GitHub repository"
              description="GitHub connection is not available yet. This is a preview of what you will link."
            />
            {repositories.map((repo) => (
              <SelectionOption
                key={repo.name}
                name={repo.name}
                meta={repo.meta}
                selected={false}
                tag={repo.tag}
                icon="github-16-gray"
                selectedIcon="github-16-blue"
              />
            ))}
          </Card>

          <Card>
            <SectionHeader
              title="Choose Discord channels"
              description="Select project channels with decisions, blockers, and coordination context."
            />
            {loadingChannels && <p className={styles.bodySmall}>Loading channels…</p>}
            {channelsError && (
              <p className={styles.bodySmall} role="alert">
                {channelsError}
              </p>
            )}
            {!loadingChannels &&
              !channelsError &&
              guilds &&
              guilds.length === 0 && (
                <p className={styles.bodySmall}>
                  No Discord channels are available to the DevSync bot yet.
                </p>
              )}
            {!loadingChannels &&
              !channelsError &&
              guilds?.map((guild) =>
                guild.channels.map((channel) => (
                  <SelectionOption
                    key={`${guild.id}:${channel.id}`}
                    name={`# ${channel.name}`}
                    meta={guild.name}
                    selected={hydrated && isSelected(channel.id)}
                    icon="hash-16-gray"
                    selectedIcon="hash-16-blue"
                    onToggle={() =>
                      toggleChannel({
                        guildId: guild.id,
                        channelId: channel.id,
                        guildName: guild.name,
                        channelName: channel.name,
                      })
                    }
                  />
                )),
              )}
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
