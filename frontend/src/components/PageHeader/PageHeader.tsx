import type { ReactNode } from "react";
import Icon from "@/components/Icon/Icon";
import styles from "./PageHeader.module.css";

type PageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
  showBack?: boolean;
  actions?: ReactNode;
};

export default function PageHeader({
  title,
  description,
  eyebrow,
  showBack = false,
  actions,
}: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.titleGroup}>
        {showBack && (
          <span className={styles.back}>
            <Icon name="arrow-left-16-gray" />
          </span>
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
