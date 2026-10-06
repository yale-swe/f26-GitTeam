import type { ReactNode } from "react";
import Icon, { type IconName } from "@/components/Icon/Icon";
import styles from "./ActivityRow.module.css";

type ActivityRowProps = {
  icon: IconName;
  title: string;
  meta: string;
  trailing?: ReactNode;
  // Smaller text for the preview lists in side panels.
  compact?: boolean;
  // Monospace title, used for commit hashes.
  mono?: boolean;
  warning?: boolean;
};

// A divider-separated list row: icon tile, title, meta line, and optional status.
export default function ActivityRow({
  icon,
  title,
  meta,
  trailing,
  compact = false,
  mono = false,
  warning = false,
}: ActivityRowProps) {
  return (
    <div className={`${styles.row} ${compact ? styles.compact : ""}`}>
      <span className={`${styles.iconTile} ${warning ? styles.iconTileWarning : ""}`}>
        <Icon name={icon} />
      </span>
      <div className={styles.copy}>
        <p className={`${styles.title} ${mono ? styles.mono : ""}`}>{title}</p>
        <p className={styles.meta}>{meta}</p>
      </div>
      {trailing}
    </div>
  );
}
