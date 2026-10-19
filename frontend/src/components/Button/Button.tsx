import Link from "next/link";
import type { ReactNode } from "react";

import Icon, { type IconName } from "@/components/Icon/Icon";
import styles from "./Button.module.css";

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  icon?: IconName;
  fullWidth?: boolean;
  /** Click handler for action buttons. */
  onClick?: () => void;
  /** When set, renders a next/link styled as a button. */
  href?: string;
  disabled?: boolean;
  type?: "button" | "submit";
};

// Wireframe button that can also act as a real control or navigation link.
export default function Button({
  children,
  variant = "secondary",
  icon,
  fullWidth = false,
  onClick,
  href,
  disabled = false,
  type = "button",
}: ButtonProps) {
  const className = [
    styles.button,
    styles[variant],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {icon && <Icon name={icon} />}
      {children}
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} className={className} onClick={onClick} disabled={disabled}>
      {content}
    </button>
  );
}
