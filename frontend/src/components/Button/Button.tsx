import Link from "next/link";
import type { ReactNode } from "react";

import Icon, { type IconName } from "@/components/Icon/Icon";
import styles from "./Button.module.css";

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "default" | "large";
  icon?: IconName;
  fullWidth?: boolean;
  /** When set, renders a next/link styled as a button. */
  href?: string;
  type?: "button" | "submit";
  /** Click handler for action buttons. */
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

// Wireframe button that can also act as a real control or navigation link.
export default function Button({
  children,
  variant = "secondary",
  size = "default",
  icon,
  fullWidth = false,
  href,
  type = "button",
  onClick,
  disabled = false,
  className: extraClassName,
}: ButtonProps) {
  const className = [
    styles.button,
    styles[variant],
    size === "large" && styles.large,
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    extraClassName,
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
