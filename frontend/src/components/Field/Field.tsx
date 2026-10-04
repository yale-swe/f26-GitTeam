import styles from "./Field.module.css";

type FieldProps = {
  label: string;
  value: string;
  multiline?: boolean;
  hint?: string;
  className?: string;
};

// Read-only form field showing a pre-filled value, as drawn in the wireframes.
export default function Field({ label, value, multiline = false, hint, className }: FieldProps) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <p className={styles.label}>{label}</p>
      <div className={`${styles.input} ${multiline ? styles.multiline : ""}`}>
        <p className={styles.value}>{value}</p>
      </div>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
