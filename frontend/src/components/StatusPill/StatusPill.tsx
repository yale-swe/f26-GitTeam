import type { ReactNode } from "react";
import Icon, { type IconName } from "@/components/Icon/Icon";
import styles from "./StatusPill.module.css";

type Tone = "green" | "amber" | "red" | "blue" | "gray";

const dotIcons: Partial<Record<Tone, IconName>> = {
  green: "dot-6-green",
  amber: "dot-6-amber",
  red: "dot-6-red",
};

type StatusPillProps = {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
};

export default function StatusPill({ children, tone = "gray", dot = false }: StatusPillProps) {
  const dotIcon = dot ? dotIcons[tone] : undefined;
  return (
    <span className={`${styles.pill} ${styles[tone]}`}>
      {dotIcon && <Icon name={dotIcon} />}
      {children}
    </span>
  );
}
