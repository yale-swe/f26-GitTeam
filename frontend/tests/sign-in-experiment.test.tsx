import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { StrictMode } from "react";

import SignInExperiment, { SIGNIN_EXPERIMENT } from "@/components/SignInExperiment/SignInExperiment";
import { assignVariant, recordConversion } from "@/lib/api";

// Fake the two experiment API calls; keep the rest of api.ts real
vi.mock("@/lib/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/api")>()),
    assignVariant: vi.fn(),
    recordConversion: vi.fn(),
}));

// Clicking the button starts Google sign-in; fake it so nothing navigates
vi.mock("@/lib/supabase/client", () => ({
    createClient: () => ({ auth: { signInWithOAuth: vi.fn().mockResolvedValue({ error: null }) } }),
}));

const button = () => screen.getByRole("button", { name: /sign in with google/i });

beforeEach(() => {
    window.sessionStorage.clear();
    vi.mocked(recordConversion).mockResolvedValue(undefined);
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("Sign-in button experiment", () => {
    test("hides the button until the color is known, so it doesn't flash blue first", async () => {
        vi.mocked(assignVariant).mockResolvedValue({ experiment: SIGNIN_EXPERIMENT, variant: "green" });

        render(<SignInExperiment />);

        expect(screen.queryByRole("button", { name: /sign in with google/i })).not.toBeInTheDocument();
        await waitFor(() => expect(button().className).toMatch(/green/));
    });

    test("shows the normal button if the backend is too slow", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        let answer: (value: { experiment: string; variant: string }) => void = () => { };
        vi.mocked(assignVariant).mockReturnValue(new Promise((resolve) => (answer = resolve)));

        render(<SignInExperiment />);
        await act(() => vi.advanceTimersByTimeAsync(1500)); // the backend hasn't answered yet
        vi.useRealTimers();

        expect(button().className).not.toMatch(/green|dark/);

        // A late answer doesn't change the button anymore
        answer({ experiment: SIGNIN_EXPERIMENT, variant: "green" });
        await waitFor(() => expect(assignVariant).toHaveBeenCalled());
        expect(button().className).not.toMatch(/green|dark/);
    });

    test("shows the color the backend picks", async () => {
        vi.mocked(assignVariant).mockResolvedValue({ experiment: SIGNIN_EXPERIMENT, variant: "green" });

        render(<SignInExperiment />);

        await waitFor(() => expect(button().className).toMatch(/green/));
        expect(assignVariant).toHaveBeenCalledWith(SIGNIN_EXPERIMENT);
    });

    test("records a conversion for that color when the button is clicked", async () => {
        vi.mocked(assignVariant).mockResolvedValue({ experiment: SIGNIN_EXPERIMENT, variant: "dark" });
        render(<SignInExperiment />);
        await waitFor(() => expect(button().className).toMatch(/dark/));

        await userEvent.click(button());

        expect(recordConversion).toHaveBeenCalledWith(SIGNIN_EXPERIMENT, "dark");
    });

    test("keeps the same color for the rest of the session without counting a new view", async () => {
        window.sessionStorage.setItem(`experiment:${SIGNIN_EXPERIMENT}`, "green");

        render(<SignInExperiment />);

        await waitFor(() => expect(button().className).toMatch(/green/));
        expect(assignVariant).not.toHaveBeenCalled();
    });

    test("falls back to the normal button and records nothing if the experiment is unavailable", async () => {
        vi.mocked(assignVariant).mockRejectedValue(new Error("API 500"));
        render(<SignInExperiment />);
        await waitFor(() => expect(button().className).not.toMatch(/green|dark/));
        expect(button().className).not.toMatch(/green|dark/);

        await userEvent.click(button());

        expect(recordConversion).not.toHaveBeenCalled();
    });

    test("counts one view even when React runs the effect twice in development", async () => {
        vi.mocked(assignVariant).mockResolvedValue({ experiment: SIGNIN_EXPERIMENT, variant: "green" });

        render(
            <StrictMode>
                <SignInExperiment />
            </StrictMode>,
        );

        await waitFor(() => expect(button().className).toMatch(/green/));
        expect(assignVariant).toHaveBeenCalledTimes(1);
    });
});