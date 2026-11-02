import type { ReactNode } from "react";
import Icon, { type IconName } from "@/components/Icon/Icon";
import styles from "./Button.module.css";
import Link from "next/link";

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  icon?: IconName;
  fullWidth?: boolean;
  href?: string;
};

export default function Button({
  children,
  variant = "secondary",
  icon,
  fullWidth = false,
  href,
}: ButtonProps) {
  const className = [styles.button, styles[variant], fullWidth && styles.fullWidth]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <Link href={href} className={className}>
        {icon && <Icon name={icon} />}
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={className}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}
