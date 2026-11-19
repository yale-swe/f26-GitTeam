import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { getDashboard, importSpec, listProjects, setFeatureCompleted } from "@/lib/api";

// Pretend the user is signed in, so apiFetch has a token to send.
vi.mock("@/lib/supabase/client", () => ({
    createClient: () => ({
        auth: { getSession: async () => ({ data: { session: { access_token: "test-token" } } }) },
    }),
}));

// The real apiFetch runs; only the browser's fetch is fake.
const fetchMock = vi.fn();

function respond(status: number, body?: unknown) {
    fetchMock.mockResolvedValue(
        new Response(body === undefined ? null : JSON.stringify(body), { status, statusText: "Status text" }),
    );
}

/** The URL and headers of the first request apiFetch sent. */
function sentRequest() {
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return { url, init, headers: new Headers(init.headers) };
}

beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("apiFetch", () => {
    test("calls the backend with the user's token and returns the JSON", async () => {
        respond(200, [{ id: "p1", name: "TrailMate" }]);

        const projects = await listProjects();

        const { url, headers } = sentRequest();
        expect(url).toBe("http://localhost:8000/api/projects");
        expect(headers.get("Authorization")).toBe("Bearer test-token");
        expect(projects).toEqual([{ id: "p1", name: "TrailMate" }]);
    });

    test("sends JSON bodies with a JSON content type", async () => {
        respond(200, {});

        await setFeatureCompleted("p1", "Accounts", true);

        const { url, init, headers } = sentRequest();
        expect(url).toBe("http://localhost:8000/api/projects/p1/features");
        expect(init.method).toBe("PATCH");
        expect(headers.get("Content-Type")).toBe("application/json");
        expect(JSON.parse(init.body as string)).toEqual({ feature: "Accounts", completed: true });
    });

    test("lets the browser set the content type for file uploads", async () => {
        respond(200, {});

        await importSpec(new File(["# Plan"], "spec.md", { type: "text/markdown" }));

        const { init, headers } = sentRequest();
        expect(init.body).toBeInstanceOf(FormData);
        expect(headers.has("Content-Type")).toBe(false);
    });

    test("throws an error with the status code when the request fails", async () => {
        respond(502);

        await expect(getDashboard("p1")).rejects.toThrow("API 502: Status text");
    });

    test("sends the user to the login page when the session has expired", async () => {
        const original = window.location;
        Object.defineProperty(window, "location", { value: { href: "/health" }, writable: true });
        respond(401);

        await expect(listProjects()).rejects.toThrow("API 401");
        expect(window.location.href).toBe("/login");

        Object.defineProperty(window, "location", { value: original, writable: true });
    });

    test("returns nothing for an empty 204 response", async () => {
        respond(204);

        await expect(listProjects()).resolves.toBeUndefined();
    });
});