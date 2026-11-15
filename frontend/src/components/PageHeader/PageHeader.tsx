import type { ReactNode } from "react";
import Icon from "@/components/Icon/Icon";
import styles from "./PageHeader.module.css";
import Link from "next/link";

type PageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
  showBack?: boolean;
  actions?: ReactNode;
  backHref?: string;
};

export default function PageHeader({
  title,
  description,
  eyebrow,
  showBack = false,
  actions,
  backHref,
}: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.titleGroup}>
        {showBack &&
          (backHref ? (
            <Link href={backHref} className={styles.back} aria-label="Back">
              <Icon name="arrow-left-16-gray" />
            </Link>
          ) : (
            <span className={styles.back}>
              <Icon name="arrow-left-16-gray" />
            </span>
          ))}
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

