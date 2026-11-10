"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import PageHeader from "@/components/PageHeader/PageHeader";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import SetupStepper from "@/components/SetupStepper/SetupStepper";
import { connectDiscord, createProject } from "@/lib/api";
import { toProjectCreate, validatePlan } from "@/lib/projectDraft";
import { useProjectDraft } from "@/lib/useProjectDraft";
import styles from "./ProjectReview.module.css";

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function ProjectReview() {
  const router = useRouter();
  const { draft, hydrated, discardDraft } = useProjectDraft();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachWarning, setAttachWarning] = useState<string | null>(null);

  const validation = useMemo(() => validatePlan(draft), [draft]);
  const blocked = validation.errors.length > 0;

  const namedFeatures = draft.features.filter((f) => f.title.trim());
  const namedMilestones = draft.milestones.filter((m) => m.title.trim());
  const namedDeliverables = draft.deliverables.filter((d) => d.title.trim());

  async function handleCreate() {
    if (blocked || submitting) return;

    setSubmitting(true);
    setError(null);
    setAttachWarning(null);

    let project;
    try {
      project = await createProject(toProjectCreate(draft));
    } catch {
      setError("The project couldn't be created. Your plan is saved — please try again.");
      setSubmitting(false);
      return;
    }

    // Attach Discord channels best-effort; a failed attach should not lose the
    // created project, so surface a non-blocking warning and continue.
    let attachFailures = 0;
    for (const channel of draft.discordChannels) {
      try {
        await connectDiscord(project.id, {
          guildId: channel.guildId,
          channelId: channel.channelId,
        });
      } catch {
        attachFailures += 1;
      }
    }

    discardDraft();

    if (attachFailures > 0) {
      setAttachWarning(
        `${attachFailures} Discord channel${attachFailures === 1 ? "" : "s"} couldn't be connected. You can connect them later from the project.`,
      );
    }

    router.push("/health");
  }

  return (
    <AppShell activeNav="projects" showProjectContext={false}>
      <PageHeader
        eyebrow="New project"
        title="Review and create"
        description="Confirm your plan and connected sources before DevSync starts tracking progress."
        showBack
      />

      <SetupStepper current={4} />

      <div className={styles.workspace}>
        <div className={styles.mainColumn}>
          <Card>
            <SectionHeader title="Project plan" description="From the plan details step" />
            {hydrated && draft.name.trim() ? (
              <>
                <p className={styles.optionName}>{draft.name}</p>
                <p className={styles.summary}>{draft.summary}</p>
              </>
            ) : (
              <p className={styles.empty}>No project name yet.</p>
            )}
          </Card>

          <Card>
            <SectionHeader title={`Features (${namedFeatures.length})`} />
            {namedFeatures.length > 0 ? (
              <ul className={styles.list}>
                {namedFeatures.map((f) => (
                  <li key={f.id} className={styles.listItem}>
                    <span>{f.title}</span>
                    {f.owner.trim() && <span className={styles.listMeta}>{f.owner}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No features added.</p>
            )}
          </Card>

          <Card>
            <SectionHeader title={`Milestones (${namedMilestones.length})`} />
            {namedMilestones.length > 0 ? (
              <ul className={styles.list}>
                {namedMilestones.map((m) => (
                  <li key={m.id} className={styles.listItem}>
                    <span>{m.title}</span>
                    <span className={styles.listMeta}>{m.date ? formatDate(m.date) : "No date"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No milestones added.</p>
            )}
          </Card>

          <Card>
            <SectionHeader title={`Deliverables (${namedDeliverables.length})`} />
            {namedDeliverables.length > 0 ? (
              <ul className={styles.list}>
                {namedDeliverables.map((d) => (
                  <li key={d.id} className={styles.listItem}>
                    <span>{d.title}</span>
                    {d.owner.trim() && <span className={styles.listMeta}>{d.owner}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No deliverables added.</p>
            )}
          </Card>
        </div>

        <div className={styles.sideColumn}>
          <Card>
            <SectionHeader title="Connected sources" />
            <p className={styles.bodySmall}>GitHub: not connected yet.</p>
            {draft.discordChannels.length > 0 ? (
              <ul className={styles.list}>
                {draft.discordChannels.map((c) => (
                  <li key={c.channelId} className={styles.listItem}>
                    <span># {c.channelName}</span>
                    <span className={styles.listMeta}>{c.guildName}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No Discord channels selected.</p>
            )}
            <Button variant="ghost" href="/projects/new/integrations" fullWidth>
              Edit integrations
            </Button>
          </Card>

          <Card>
            <SectionHeader title="Create project" />
            {blocked ? (
              <>
                <p className={styles.bodySmall}>Fix these before creating the project:</p>
                <ul className={styles.errorList}>
                  {validation.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
                <Button variant="ghost" href="/projects/new" fullWidth>
                  Back to plan details
                </Button>
              </>
            ) : (
              <p className={styles.bodySmall}>
                This creates your project and starts tracking against the plan.
              </p>
            )}
            {error && (
              <p className={styles.alert} role="alert">
                {error}
              </p>
            )}
            {attachWarning && (
              <p className={styles.note} role="status">
                {attachWarning}
              </p>
            )}
            <Button
              variant="primary"
              icon="arrow-right-15-white"
              onClick={handleCreate}
              disabled={blocked || submitting || !hydrated}
              fullWidth
            >
              {submitting ? "Creating…" : "Create project"}
            </Button>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
