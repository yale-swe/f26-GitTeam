import styles from "./SectionHeader.module.css";

type SectionHeaderProps = {
  title: string;
  description?: string;
  action?: string;
  /** When set, the action renders as a clickable button. */
  onAction?: () => void;
};

export default function SectionHeader({ title, description, action, onAction }: SectionHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.heading}>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {action &&
        (onAction ? (
          <button type="button" className={styles.actionButton} onClick={onAction}>
            {action}
          </button>
        ) : (
          <p className={styles.action}>{action}</p>
        ))}
    </div>
  );
}
