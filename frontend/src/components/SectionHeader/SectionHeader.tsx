import styles from "./SectionHeader.module.css";

type SectionHeaderProps = {
  title: string;
  description?: string;
  action?: string;
};

export default function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.heading}>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {action && <p className={styles.action}>{action}</p>}
    </div>
  );
}
