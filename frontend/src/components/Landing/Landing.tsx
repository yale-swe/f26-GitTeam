import GoogleSignInButton from "@/components/GoogleSignInButton/GoogleSignInButton";
import Button from "@/components/Button/Button";
import LandingPreview from "@/components/LandingPreview/LandingPreview";
import StatusPill from "@/components/StatusPill/StatusPill";
import styles from "./Landing.module.css";
import SignInExperiment from "@/components/SignInExperiment/SignInExperiment";

function Brand() {
  return (
    <div className={styles.brand}>
      <span className={styles.brandMark} aria-hidden="true">
        D
      </span>
      <span className={styles.brandName} translate="no">
        DevSync
      </span>
    </div>
  );
}

export default function Landing() {
  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Brand />
        <Button href="/login">Sign in</Button>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <h1 className={styles.title}>See where your project really stands.</h1>
            <p className={styles.lead}>
              DevSync compares your team&rsquo;s GitHub and Discord activity against your plan, so you
              can see progress, blockers, and deadlines without chasing anyone for a status update.
            </p>
            <div className={styles.actions}>
              <SignInExperiment />
              <p className={styles.note}>Uses your Google account. No new password to create.</p>
            </div>
          </div>
          <LandingPreview />
        </section>

        <section className={styles.how} aria-labelledby="how-heading">
          <h2 id="how-heading" className={styles.sectionHeading}>
            From plan to project health
          </h2>
          <ol className={styles.steps}>
            <li className={styles.step}>
              <h3 className={styles.stepTitle}>Write down the plan</h3>
              <p className={styles.stepBody}>
                Add your milestones, deliverables, and deadlines once. They become the yardstick for
                everything else.
              </p>
              <div className={styles.stepArtifact}>
                <StatusPill tone="blue">Beta checkout &middot; Oct 18</StatusPill>
              </div>
            </li>
            <li className={styles.step}>
              <h3 className={styles.stepTitle}>Connect where the work happens</h3>
              <p className={styles.stepBody}>
                GitHub commits and pull requests and the Discord channels you choose sync in
                automatically.
              </p>
              <div className={styles.stepArtifact}>
                <StatusPill tone="green" dot>
                  GitHub
                </StatusPill>
                <StatusPill tone="green" dot>
                  Discord
                </StatusPill>
              </div>
            </li>
            <li className={styles.step}>
              <h3 className={styles.stepTitle}>Read the health</h3>
              <p className={styles.stepBody}>
                Progress, deadlines, and blockers in one dashboard. If a source goes stale or fails,
                DevSync says so instead of showing old data as current.
              </p>
              <div className={styles.stepArtifact}>
                <StatusPill tone="amber" dot>
                  Needs attention
                </StatusPill>
              </div>
            </li>
          </ol>
        </section>

        <section className={styles.closing} aria-labelledby="closing-heading">
          <div className={styles.closingInner}>
            <h2 id="closing-heading" className={styles.closingTitle}>
              Know where the project stands before the next sync.
            </h2>
            <GoogleSignInButton variant="secondary" size="large" />
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <Brand />
      </footer>
    </div>
  );
}
