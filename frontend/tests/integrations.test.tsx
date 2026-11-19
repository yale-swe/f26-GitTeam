import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import ConnectIntegrations from "@/components/ConnectIntegrations/ConnectIntegrations";
import { listDiscordChannels } from "@/lib/api";
import type { DiscordGuildOption } from "@/lib/types";

// Replace API calls with fakes; keep everything else in api.ts real.
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  listDiscordChannels: vi.fn(),
}));

const guilds: DiscordGuildOption[] = [
  {
    id: "g1",
    name: "Campus Cart",
    channels: [
      { id: "c1", name: "dev" },
      { id: "c2", name: "standup" },
    ],
  },
];

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(listDiscordChannels).mockReset();
});

afterEach(() => {
  cleanup();
});

describe("GitHub and Discord onboarding", () => {
  test("the back arrow returns to the project plan", async () => {
    vi.mocked(listDiscordChannels).mockResolvedValue(guilds);
    render(<ConnectIntegrations />);

    expect(await screen.findByRole("link", { name: "Back to project plan" })).toHaveAttribute(
      "href",
      "/projects/new",
    );
  });

  test("shows a loading state while Discord channels load", async () => {
    let resolve: (value: DiscordGuildOption[]) => void = () => {};
    vi.mocked(listDiscordChannels).mockReturnValue(
      new Promise<DiscordGuildOption[]>((r) => {
        resolve = r;
      }),
    );

    render(<ConnectIntegrations />);

    expect(screen.getByText(/Loading channels/)).toBeInTheDocument();

    resolve(guilds);
    await waitFor(() => expect(screen.queryByText(/Loading channels/)).not.toBeInTheDocument());
  });

  test("shows an error when Discord channels can't be loaded", async () => {
    vi.mocked(listDiscordChannels).mockRejectedValue(new Error("API 500"));

    render(<ConnectIntegrations />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't be loaded/);
  });

  test("shows an empty state when no channels are available", async () => {
    vi.mocked(listDiscordChannels).mockResolvedValue([]);

    render(<ConnectIntegrations />);

    expect(await screen.findByText(/No Discord channels are available/)).toBeInTheDocument();
  });

  test("displays and toggles the permitted Discord channels", async () => {
    vi.mocked(listDiscordChannels).mockResolvedValue(guilds);

    render(<ConnectIntegrations />);

    const devChannel = await screen.findByRole("button", { name: /# dev/ });
    expect(devChannel).toHaveAttribute("aria-pressed", "false");

    // Selecting a channel marks it pressed and updates the status summary.
    fireEvent.click(devChannel);
    await waitFor(() => expect(devChannel).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByText(/1 channel selected/)).toBeInTheDocument();

    // Choosing another channel replaces the selection instead of adding it.
    const standupChannel = screen.getByRole("button", { name: /# standup/ });
    fireEvent.click(standupChannel);
    await waitFor(() => expect(standupChannel).toHaveAttribute("aria-pressed", "true"));
    expect(devChannel).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/1 channel selected/)).toBeInTheDocument();

    // Toggling the selected channel deselects it.
    fireEvent.click(standupChannel);
    await waitFor(() => expect(standupChannel).toHaveAttribute("aria-pressed", "false"));
  });

  test("selects GitHub and can clear that choice", async () => {
    vi.mocked(listDiscordChannels).mockResolvedValue(guilds);

    render(<ConnectIntegrations />);

    const github = await screen.findByRole("button", { name: /Connect GitHub/ });
    expect(github).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(github);
    await waitFor(() => expect(github).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByText("Connects after the project is created")).toBeInTheDocument();

    fireEvent.click(github);
    await waitFor(() => expect(github).toHaveAttribute("aria-pressed", "false"));
    expect(screen.getByText(/Optional. Connect a repository/)).toBeInTheDocument();
  });
  test.todo("previews data imported from the selected repository and channels");
});
