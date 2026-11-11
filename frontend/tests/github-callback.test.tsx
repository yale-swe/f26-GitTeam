import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import GitHubCallback from "@/components/GitHubCallback/GitHubCallback";
import { connectGitHub, selectGitHubRepository, syncGitHub } from "@/lib/github";
import type { GitHubIntegration, GitHubRepository } from "@/lib/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/integrations/github/callback",
}));
vi.mock("@/lib/github", () => ({
  connectGitHub: vi.fn(),
  selectGitHubRepository: vi.fn(),
  syncGitHub: vi.fn(),
}));

function repo(id: number, name: string): GitHubRepository {
  return {
    id,
    owner: "ada",
    name,
    fullName: `ada/${name}`,
    defaultBranch: "main",
    htmlUrl: `https://github.com/ada/${name}`,
    private: true,
  };
}

function integration(repositories: GitHubRepository[]): GitHubIntegration {
  return {
    provider: "github",
    status: "connected",
    lastSuccessfulSyncAt: null,
    lastSyncError: null,
    repository: repositories.length === 1 ? repositories[0] : null,
    repositories,
  };
}

function renderCallback(params: Partial<Parameters<typeof GitHubCallback>[0]> = {}) {
  return render(
    <StrictMode>
      <GitHubCallback projectId="p1" installationId="42" code="code" {...params} />
    </StrictMode>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GitHub callback", () => {
  test("connects once, syncs, and opens project health when there is one repository", async () => {
    vi.mocked(connectGitHub).mockResolvedValue(integration([repo(1, "api")]));
    vi.mocked(syncGitHub).mockResolvedValue({ provider: "github", status: "healthy", importedCount: 3 });

    renderCallback();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/health"));
    expect(connectGitHub).toHaveBeenCalledTimes(1);
    expect(connectGitHub).toHaveBeenCalledWith("p1", { installationId: 42, authorizationCode: "code" });
    expect(syncGitHub).toHaveBeenCalledTimes(1);
    expect(syncGitHub).toHaveBeenCalledWith("p1");
  });

  test("lets the user choose when the app has several repositories", async () => {
    vi.mocked(connectGitHub).mockResolvedValue(integration([repo(1, "api"), repo(2, "web")]));
    vi.mocked(selectGitHubRepository).mockResolvedValue(integration([repo(2, "web")]));
    vi.mocked(syncGitHub).mockResolvedValue({ provider: "github", status: "healthy", importedCount: 0 });

    renderCallback();
    fireEvent.click(await screen.findByRole("button", { name: "ada/web" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/health"));
    expect(selectGitHubRepository).toHaveBeenCalledWith("p1", {
      repositoryOwner: "ada",
      repositoryName: "web",
    });
  });

  test("still opens project health when the first sync fails", async () => {
    vi.mocked(connectGitHub).mockResolvedValue(integration([repo(1, "api")]));
    vi.mocked(syncGitHub).mockRejectedValue(new Error("API 502"));

    renderCallback();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/health"));
  });

  test("shows an error when connecting fails", async () => {
    vi.mocked(connectGitHub).mockRejectedValue(new Error("API 403"));

    renderCallback();

    expect(await screen.findByRole("alert")).toHaveTextContent("GitHub couldn't be connected");
    expect(syncGitHub).not.toHaveBeenCalled();
  });

  test("shows an error without calling the API when GitHub sent no code", () => {
    renderCallback({ code: undefined });

    expect(screen.getByRole("alert")).toHaveTextContent("GitHub couldn't be connected");
    expect(connectGitHub).not.toHaveBeenCalled();
  });

  test("explains that an organization owner must approve a requested install", () => {
    renderCallback({ installationId: undefined, code: undefined, setupAction: "request" });

    expect(screen.getByRole("alert")).toHaveTextContent("has to approve DevSync");
  });
});
