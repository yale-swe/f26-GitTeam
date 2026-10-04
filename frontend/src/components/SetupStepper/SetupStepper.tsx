import styles from "./SetupStepper.module.css";

const steps = ["Project basics", "Plan details", "Integrations", "Review"];

// Progress through new-project setup. `current` is 1-based; steps up to it are filled.
export default function SetupStepper({ current }: { current: number }) {
  return (
    <ol className={styles.stepper}>
      {steps.map((label, i) => {
        const step = i + 1;
        const isLast = step === steps.length;
        const reached = step <= current;
        return (
          <li key={label} className={`${styles.step} ${isLast ? styles.lastStep : ""}`}>
            <span className={`${styles.marker} ${reached ? styles.markerReached : ""}`}>{step}</span>
            <span
              className={[
                styles.label,
                reached ? styles.labelReached : "",
                step === current ? styles.labelCurrent : "",
              ].join(" ")}
            >
              {label}
            </span>
            {!isLast && (
              <span className={`${styles.connector} ${step < current ? styles.connectorDone : ""}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
