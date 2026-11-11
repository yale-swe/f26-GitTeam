import { apiFetch } from "@/lib/api";
import type { GitHubIntegration, SyncResult } from "@/lib/types";

// FastAPI only parses a JSON body when the request says it is JSON.
const JSON_HEADERS = { "Content-Type": "application/json" };

function githubPath(projectId: string) {
  return `/api/projects/${projectId}/integrations/github`;
}

/** The GitHub page that installs the DevSync app; GitHub returns `projectId` as `state`. */
export function getGitHubInstallUrl(projectId: string) {
  return apiFetch<{ url: string }>(
    `/api/github/install-url?projectId=${encodeURIComponent(projectId)}`,
  );
}

/** Finish the install callback. `repository` is null when the user must pick one. */
export function connectGitHub(
  projectId: string,
  body: { installationId: number; authorizationCode: string },
) {
  return apiFetch<GitHubIntegration>(githubPath(projectId), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

/** Choose which of the installation's repositories the project syncs. */
export function selectGitHubRepository(
  projectId: string,
  body: { repositoryOwner: string; repositoryName: string },
) {
  return apiFetch<GitHubIntegration>(`${githubPath(projectId)}/repository`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

/** Import new commits and pull requests from the project's repository. */
export function syncGitHub(projectId: string) {
  return apiFetch<SyncResult>(`${githubPath(projectId)}/sync`, { method: "POST" });
}
