import styles from "./Avatar.module.css";

type AvatarProps = {
  initials: string;
  tone?: "dark" | "light" | "blue";
  size?: 26 | 30;
  // White ring used when avatars overlap in a stack.
  ring?: boolean;
};

export default function Avatar({ initials, tone = "dark", size = 30, ring = false }: AvatarProps) {
  const className = [styles.avatar, styles[tone], styles[`size${size}`], ring && styles.ring]
    .filter(Boolean)
    .join(" ");
  return <span className={className}>{initials}</span>;
}
