import { afterEach, describe, expect, test, vi } from "vitest";

import { apiFetch } from "@/lib/api";
import {
  connectGitHub,
  getGitHubInstallUrl,
  selectGitHubRepository,
  syncGitHub,
} from "@/lib/github";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

const JSON_HEADERS = { "Content-Type": "application/json" };

afterEach(() => {
  vi.clearAllMocks();
});

describe("GitHub API client", () => {
  test("asks for the install URL of a project", () => {
    getGitHubInstallUrl("p 1");

    expect(apiFetch).toHaveBeenCalledWith("/api/github/install-url?projectId=p%201");
  });

  test("connects with the installation id and code from the callback", () => {
    connectGitHub("p1", { installationId: 42, authorizationCode: "code" });

    expect(apiFetch).toHaveBeenCalledWith("/api/projects/p1/integrations/github", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ installationId: 42, authorizationCode: "code" }),
    });
  });

  test("selects a repository", () => {
    selectGitHubRepository("p1", { repositoryOwner: "ada", repositoryName: "api" });

    expect(apiFetch).toHaveBeenCalledWith("/api/projects/p1/integrations/github/repository", {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify({ repositoryOwner: "ada", repositoryName: "api" }),
    });
  });

  test("syncs a project", () => {
    syncGitHub("p1");

    expect(apiFetch).toHaveBeenCalledWith("/api/projects/p1/integrations/github/sync", {
      method: "POST",
    });
  });
});
