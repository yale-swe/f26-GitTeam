"use client";

import { useEffect, useState } from "react";

import Icon from "@/components/Icon/Icon";
import { listDiscordChannels } from "@/lib/api";
import type { DiscordGuildOption } from "@/lib/types";
import styles from "./DiscordChannelPicker.module.css";

export type DiscordChannelSelection = {
  guildId: string;
  channelId: string;
  guildName: string;
  channelName: string;
};

type DiscordChannelPickerProps = {
  selectedChannelId?: string | null;
  onSelect: (selection: DiscordChannelSelection | null) => void;
  onLoadError?: () => void;
};

export default function DiscordChannelPicker({
  selectedChannelId = null,
  onSelect,
  onLoadError,
}: DiscordChannelPickerProps) {
  const [guilds, setGuilds] = useState<DiscordGuildOption[] | null>(null);
  const [channelsError, setChannelsError] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(true);

  useEffect(() => {
    let active = true;
    listDiscordChannels()
      .then((data) => {
        if (active) setGuilds(data);
      })
      .catch(() => {
        if (!active) return;
        setChannelsError(true);
        onLoadError?.();
      })
      .finally(() => {
        if (active) setLoadingChannels(false);
      });
    return () => {
      active = false;
    };
  }, [onLoadError]);

  if (loadingChannels) {
    return <p className={styles.state}>Loading channels…</p>;
  }

  if (channelsError) {
    return (
      <p className={styles.state} role="alert">
        Discord channels couldn&apos;t be loaded. Try refreshing the page.
      </p>
    );
  }

  const channels = guilds?.flatMap((guild) =>
    guild.channels.map((channel) => ({ guild, channel })),
  );

  if (!channels || channels.length === 0) {
    return <p className={styles.state}>No Discord channels are available to the DevSync bot yet.</p>;
  }

  return (
    <div className={styles.options}>
      {channels.map(({ guild, channel }) => {
        const selected = selectedChannelId === channel.id;
        return (
          <button
            key={`${guild.id}:${channel.id}`}
            type="button"
            className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
            onClick={() =>
              onSelect(
                selected
                  ? null
                  : {
                      guildId: guild.id,
                      channelId: channel.id,
                      guildName: guild.name,
                      channelName: channel.name,
                    },
              )
            }
            aria-pressed={selected}
          >
            <span className={styles.sourceIcon}>
              <Icon name={selected ? "hash-16-blue" : "hash-16-gray"} />
            </span>
            <span className={styles.optionCopy}>
              <span className={styles.optionName}># {channel.name}</span>
              <span className={styles.optionMeta}>{guild.name}</span>
            </span>
            <span className={`${styles.radio} ${selected ? styles.radioSelected : ""}`}>
              {selected && <span className={styles.radioDot} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
