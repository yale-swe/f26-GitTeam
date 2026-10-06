import type { ReactNode } from "react";
import Icon, { type IconName } from "@/components/Icon/Icon";
import styles from "./Button.module.css";

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  icon?: IconName;
  fullWidth?: boolean;
};

// Static wireframe button: no click behavior is wired up.
export default function Button({
  children,
  variant = "secondary",
  icon,
  fullWidth = false,
}: ButtonProps) {
  const className = [styles.button, styles[variant], fullWidth && styles.fullWidth]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={className}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}
