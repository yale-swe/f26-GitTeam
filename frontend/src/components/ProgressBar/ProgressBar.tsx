import styles from "./ProgressBar.module.css";

const SEGMENTS = 10;

// Segmented bar from the wireframes; `filled` is how many of the 10 segments are blue.
export default function ProgressBar({ filled }: { filled: number }) {
  return (
    <div className={styles.bar}>
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <div key={i} className={i < filled ? styles.filled : styles.empty} />
      ))}
    </div>
  );
}
