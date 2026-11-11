"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell/AppShell";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import PageHeader from "@/components/PageHeader/PageHeader";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import { connectGitHub, selectGitHubRepository, syncGitHub } from "@/lib/github";
import type { GitHubRepository } from "@/lib/types";
import styles from "./GitHubCallback.module.css";

type Props = {
  // GitHub adds these to the callback URL; `projectId` comes back as `state`.
  projectId?: string;
  installationId?: string;
  code?: string;
  setupAction?: string;
};

type State =
  | { status: "connecting" }
  | { status: "choose"; repositories: GitHubRepository[] }
  | { status: "syncing" }
  | { status: "error"; message: string };

const CONNECT_FAILED = "GitHub couldn't be connected. Try connecting again from the project health page.";

function initialState({ projectId, installationId, code, setupAction }: Props): State {
  if (setupAction === "request") {
    return {
      status: "error",
      message: "An owner of that GitHub organization has to approve DevSync. Connect again once they have.",
    };
  }
  if (!projectId || !installationId || !code) return { status: "error", message: CONNECT_FAILED };
  return { status: "connecting" };
}

// A failed first sync still opens the dashboard, which shows GitHub as stale or failed.
async function syncThenOpenHealth(projectId: string, router: ReturnType<typeof useRouter>) {
  await syncGitHub(projectId).catch(() => undefined);
  router.push("/health");
}

export default function GitHubCallback(props: Props) {
  const { projectId = "", installationId, code = "" } = props;
  const router = useRouter();
  const [state, setState] = useState<State>(() => initialState(props));
  // The code works only once, so React's development double-run must not send it twice.
  const connectStarted = useRef(false);

  useEffect(() => {
    if (state.status !== "connecting" || connectStarted.current) return;
    connectStarted.current = true;
    connectGitHub(projectId, { installationId: Number(installationId), authorizationCode: code })
      .then((integration) => {
        if (!integration.repository) {
          setState({ status: "choose", repositories: integration.repositories });
          return;
        }
        setState({ status: "syncing" });
        return syncThenOpenHealth(projectId, router);
      })
      .catch(() => setState({ status: "error", message: CONNECT_FAILED }));
  }, [state.status, projectId, installationId, code, router]);

  async function choose(repository: GitHubRepository) {
    try {
      await selectGitHubRepository(projectId, {
        repositoryOwner: repository.owner,
        repositoryName: repository.name,
      });
    } catch {
      setState({ status: "error", message: "That repository couldn't be selected. Please try again." });
      return;
    }
    setState({ status: "syncing" });
    await syncThenOpenHealth(projectId, router);
  }

  return (
    <AppShell activeNav="health">
      <PageHeader
        title="Connect GitHub"
        description="DevSync reads commits and pull requests from one repository, with read-only access."
      />
      <Card>
        {state.status === "connecting" && <p>Connecting GitHub…</p>}
        {state.status === "syncing" && <p>Importing commits and pull requests…</p>}
        {state.status === "error" && (
          <>
            <p role="alert">{state.message}</p>
            <Button href="/health">Back to project health</Button>
          </>
        )}
        {state.status === "choose" && (
          <>
            <SectionHeader
              title="Choose a repository"
              description="DevSync syncs one repository per project."
            />
            {state.repositories.length === 0 && (
              <p>The DevSync app wasn&apos;t given any repositories. Connect again and pick one.</p>
            )}
            <div className={styles.repositories}>
              {state.repositories.map((repository) => (
                <Button key={repository.id} fullWidth onClick={() => choose(repository)}>
                  {repository.fullName}
                </Button>
              ))}
            </div>
          </>
        )}
      </Card>
    </AppShell>
  );
}
