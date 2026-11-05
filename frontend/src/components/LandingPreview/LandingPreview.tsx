import Icon from "@/components/Icon/Icon";
import ProgressBar from "@/components/ProgressBar/ProgressBar";
import StatusPill from "@/components/StatusPill/StatusPill";
import styles from "./LandingPreview.module.css";

// Static, clearly labeled sample content. It deliberately does not use the
// date helpers in dashboardFormat (they read the clock) so the sample never
// drifts into "overdue".
const milestones = [
  { title: "Plan approved", date: "Sep 05", state: "done" },
  { title: "Core marketplace", date: "Oct 10", state: "done" },
  { title: "Beta checkout", date: "Oct 18", state: "risk" },
  { title: "Final release", date: "Oct 31", state: "planned" },
] as const;

export default function LandingPreview() {
  return (
    <figure className={styles.figure}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div>
            <p className={styles.name}>Campus Cart</p>
            <p className={styles.meta}>Student marketplace app</p>
          </div>
          <StatusPill tone="amber" dot>
            Needs attention
          </StatusPill>
        </div>

        <section className={styles.section} aria-label="Milestones">
          <div className={styles.sectionHead}>
            <p className={styles.sectionTitle}>Milestones</p>
            <span className={styles.count}>2 of 4 done</span>
          </div>
          <ProgressBar filled={5} />
          <ul className={styles.list}>
            {milestones.map((m) => (
              <li key={m.title} className={styles.row}>
                <span className={styles.rowTitle}>
                  {m.state === "done" ? (
                    <Icon name="check-14-green" />
                  ) : m.state === "risk" ? (
                    <Icon name="alert-triangle-14-amber" />
                  ) : (
                    <Icon name="calendar-14-gray" />
                  )}
                  {m.state === "done" && <span className="sr-only">Done: </span>}
                  {m.state === "planned" && <span className="sr-only">Planned: </span>}
                  {m.title}
                </span>
                <span className={styles.rowMeta}>{m.date}</span>
                {m.state === "risk" && <StatusPill tone="amber">At risk</StatusPill>}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-label="Sources">
          <p className={styles.sectionTitle}>Sources</p>
          <ul className={styles.list}>
            <li className={styles.row}>
              <span className={styles.rowTitle}>
                <Icon name="github-14-gray" />
                GitHub
              </span>
              <span className={styles.rowMeta}>Synced 2 hours ago</span>
              <Icon name="dot-6-green" />
            </li>
            <li className={styles.row}>
              <span className={styles.rowTitle}>
                <Icon name="hash-14-gray" />
                Discord
              </span>
              <span className={styles.rowMeta}>Stale, last synced 3 days ago</span>
              <Icon name="dot-6-amber" />
            </li>
          </ul>
        </section>

        <p className={styles.blocker}>
          <Icon name="alert-triangle-14-amber" />
          Blocker: free image-storage quota may be too small
        </p>
      </div>
      <figcaption className={styles.caption}>
        Sample project with illustrative data.
      </figcaption>
    </figure>
  );
}
