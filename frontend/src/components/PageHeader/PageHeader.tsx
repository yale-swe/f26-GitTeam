import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "@/components/Icon/Icon";
import styles from "./PageHeader.module.css";

type PageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
  showBack?: boolean;
  /** When set, the back arrow is a link to this path. */
  backHref?: string;
  actions?: ReactNode;
};

export default function PageHeader({
  title,
  description,
  eyebrow,
  showBack = false,
  backHref,
  actions,
}: PageHeaderProps) {
  const backIcon = <Icon name="arrow-left-16-gray" />;

  return (
    <header className={styles.header}>
      <div className={styles.titleGroup}>
        {backHref ? (
          <Link href={backHref} className={styles.back} aria-label="Back">
            {backIcon}
          </Link>
        ) : (
          showBack && <span className={styles.back}>{backIcon}</span>
        )}
        <div className={styles.copy}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
