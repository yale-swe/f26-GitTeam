import { useId } from "react";

import styles from "./Field.module.css";

type FieldProps = {
  label: string;
  value: string;
  multiline?: boolean;
  hint?: string;
  className?: string;
  /** When provided, the field becomes an editable input/textarea. */
  onChange?: (value: string) => void;
  /** Placeholder shown on editable fields when empty. */
  placeholder?: string;
  /** Inline validation message shown under the control. */
  error?: string;
  type?: string;
};

// Read-only by default (as drawn in the wireframes). Pass `onChange` to make it
// an editable, labelled input or textarea.
export default function Field({
  label,
  value,
  multiline = false,
  hint,
  className,
  onChange,
  placeholder,
  error,
  type = "text",
}: FieldProps) {
  const id = useId();
  const editable = typeof onChange === "function";

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {editable ? (
        multiline ? (
          <textarea
            id={id}
            className={[styles.control, styles.controlMultiline, error ? styles.controlError : ""]
              .filter(Boolean)
              .join(" ")}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={error ? true : undefined}
          />
        ) : (
          <input
            id={id}
            type={type}
            className={[styles.control, error ? styles.controlError : ""]
              .filter(Boolean)
              .join(" ")}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={error ? true : undefined}
          />
        )
      ) : (
        <div id={id} className={`${styles.input} ${multiline ? styles.multiline : ""}`}>
          <p className={styles.value}>{value}</p>
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
