import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import GoogleSignInButton from "@/components/GoogleSignInButton/GoogleSignInButton";
import Landing from "@/components/Landing/Landing";
import { resolveAuthRedirect, safeNextPath } from "@/lib/authRedirect";

const signInWithOAuth = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOAuth } }),
}));

beforeEach(() => {
  signInWithOAuth.mockReset().mockResolvedValue({ error: null });
});

afterEach(() => {
  cleanup();
});

describe("route access rules", () => {
  test.each(["/projects", "/projects/new", "/health", "/milestones", "/anything-else"])(
    "sends signed-out visitors from %s to /login",
    (path) => {
      expect(resolveAuthRedirect(path, false)).toBe("/login");
    },
  );

  test.each(["/", "/login", "/auth/callback"])("lets signed-out visitors open %s", (path) => {
    expect(resolveAuthRedirect(path, false)).toBeNull();
  });

  test("sends signed-in visitors from the landing and login pages to /projects", () => {
    expect(resolveAuthRedirect("/", true)).toBe("/projects");
    expect(resolveAuthRedirect("/login", true)).toBe("/projects");
    expect(resolveAuthRedirect("/health", true)).toBeNull();
  });
});

describe("post-login redirect target", () => {
  test("keeps same-origin paths", () => {
    expect(safeNextPath("/milestones?x=1")).toBe("/milestones?x=1");
  });

  test.each([null, "", "https://evil.example", "//evil.example", "/\\evil.example", "projects"])(
    "falls back to /projects for %j",
    (value) => {
      expect(safeNextPath(value)).toBe("/projects");
    },
  );
});

describe("Google sign-in", () => {
  test("starts the Google OAuth flow with the callback as redirect", async () => {
    render(<GoogleSignInButton next="/health" />);

    await userEvent.click(screen.getByRole("button", { name: /sign in with google/i }));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1));
    const arg = signInWithOAuth.mock.calls[0][0];
    expect(arg.provider).toBe("google");
    expect(arg.options.redirectTo).toBe(`${window.location.origin}/auth/callback?next=%2Fhealth`);
  });

  test("re-enables the button if sign-in fails", async () => {
    signInWithOAuth.mockResolvedValue({ error: new Error("boom") });
    render(<GoogleSignInButton />);

    await userEvent.click(screen.getByRole("button", { name: /sign in with google/i }));

    expect(await screen.findByRole("button", { name: /sign in with google/i })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn.t start google sign-in/i);
  });
});

describe("Landing page", () => {
  test("leads with the outcome and offers Google sign-in in two places", async () => {
    render(<Landing />);

    expect(
      screen.getByRole("heading", { level: 1, name: /see where your project really stands/i }),
    ).toBeInTheDocument();
    // The hero button appears once the color experiment has answered (or failed)
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /sign in with google/i })).toHaveLength(2),
    );
  });

  test("links the top bar to the login page", () => {
    render(<Landing />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  test("explains the three steps from plan to health", () => {
    render(<Landing />);

    const section = screen.getByRole("region", { name: /from plan to project health/i });
    const steps = within(section).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(within(section).getByText(/says so instead of showing old data as current/i)).toBeInTheDocument();
  });

  test("labels the preview as sample data and shows a stale source", () => {
    render(<Landing />);

    expect(screen.getByText(/sample project with illustrative data/i)).toBeInTheDocument();
    expect(screen.getByText(/stale, last synced 3 days ago/i)).toBeInTheDocument();
  });
});
