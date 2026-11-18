import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import SpecImport from "@/components/SpecImport/SpecImport";
import { importSpec } from "@/lib/api";
import type { SpecImportResult } from "@/lib/types";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// Replace the upload call with a fake; keep everything else in api.ts real.
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  importSpec: vi.fn(),
}));

const STORAGE_KEY = "devsync.projectDraft.v1";

const result: SpecImportResult = {
  filename: "spec.md",
  plan: {
    name: "Campus Cart",
    summary: "A campus marketplace.",
    features: ["Accounts", "Listings"],
    milestones: [
      { title: "Core", date: "2030-10-10", deliverables: ["Login"] },
      { title: "Beta", date: null, deliverables: [] },
    ],
  },
  warnings: ["Milestone 'Beta' has no date in the document."],
};

const specFile = () => new File(["# Campus Cart"], "spec.md", { type: "text/markdown" });

async function uploadAndImport(file: File = specFile()) {
  // applyAccept: false lets tests pick files the input's `accept` would hide.
  const user = userEvent.setup({ applyAccept: false });
  render(<SpecImport />);
  await user.upload(screen.getByLabelText("Specification file"), file);
  await user.click(screen.getByRole("button", { name: "Import" }));
  return user;
}

beforeEach(() => {
  window.localStorage.clear();
  pushMock.mockReset();
  vi.mocked(importSpec).mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Project specification import", () => {
  test("the back arrow returns to the project plan", () => {
    render(<SpecImport />);

    expect(screen.getByRole("link", { name: "Back to project plan" })).toHaveAttribute("href", "/projects/new");
  });

  test("uploads a supported project specification", async () => {
    vi.mocked(importSpec).mockResolvedValue(result);
    await uploadAndImport();

    expect(importSpec).toHaveBeenCalledTimes(1);
    expect(vi.mocked(importSpec).mock.calls[0][0].name).toBe("spec.md");
  });

  test("shows progress while the specification is being processed", async () => {
    // A promise that never resolves keeps the page in its "uploading" state.
    vi.mocked(importSpec).mockReturnValue(new Promise(() => { }));
    await uploadAndImport();

    const button = screen.getByRole("button", { name: /reading your specification/i });
    expect(button).toBeDisabled();
  });

  test("displays extracted details and marks fields that need review", async () => {
    vi.mocked(importSpec).mockResolvedValue(result);
    await uploadAndImport();

    expect(await screen.findByText(/Campus Cart · 2 features · 2 milestones · 1 deliverables/)).toBeInTheDocument();
    expect(screen.getByText("Accounts")).toBeInTheDocument();
    // Only "Beta" is mentioned in a warning, so only it is marked.
    expect(screen.getAllByText("Needs review")).toHaveLength(1);
  });

  test("shows the imported file's source metadata and extraction status", async () => {
    vi.mocked(importSpec).mockResolvedValue(result);
    await uploadAndImport();

    expect(await screen.findByText("Found in spec.md")).toBeInTheDocument();
    expect(screen.getByText(/1 item to review/)).toBeInTheDocument();
  });

  test("shows extraction-quality indicators for the reviewed fields", async () => {
    vi.mocked(importSpec).mockResolvedValue(result);
    await uploadAndImport();

    expect(await screen.findByText("Milestone 'Beta' has no date in the document.")).toBeInTheDocument();
  });

  test("fills the plan form with the imported plan when it is used", async () => {
    vi.mocked(importSpec).mockResolvedValue(result);
    const user = await uploadAndImport();

    await user.click(await screen.findByRole("button", { name: "Use this plan" }));

    expect(pushMock).toHaveBeenCalledWith("/projects/new");
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
      expect(stored.draft.name).toBe("Campus Cart");
    });
  });

  test("handles unsupported files, extraction errors, and file replacement", async () => {
    // Unsupported type: rejected locally, no upload.
    await uploadAndImport(new File(["x"], "photo.png", { type: "image/png" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Upload a PDF, DOCX, Markdown, or text file/);
    expect(importSpec).not.toHaveBeenCalled();
    cleanup();

    // Extraction error from the backend.
    vi.mocked(importSpec).mockRejectedValue(new Error("API 502: Bad Gateway"));
    await uploadAndImport();
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't be extracted/);
    cleanup();

    // Replacement: "Choose another file" clears the result.
    vi.mocked(importSpec).mockResolvedValue(result);
    const user = await uploadAndImport();
    await user.click(await screen.findByRole("button", { name: "Choose another file" }));
    expect(screen.queryByText("Found in spec.md")).not.toBeInTheDocument();
  });

  test("rejects files over 10 MB without uploading", async () => {
    const big = specFile();
    Object.defineProperty(big, "size", { value: 10 * 1024 * 1024 + 1 });
    await uploadAndImport(big);

    expect(screen.getByRole("alert")).toHaveTextContent(/too large/i);
    expect(importSpec).not.toHaveBeenCalled();
  });

  test.each([
    ["API 413: Payload Too Large", /too large/i],
    ["API 415: Unsupported Media Type", /Upload a PDF, DOCX, Markdown, or text file/],
    ["API 422: Unprocessable Content", /No readable text/],
    ["Network down", /Something went wrong/],
  ])("shows a clear message for %s", async (apiError, message) => {
    vi.mocked(importSpec).mockRejectedValue(new Error(apiError));
    await uploadAndImport();

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  test("keeps the existing draft when the user cancels replacing it", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ draft: { name: "My old plan" }, savedAt: new Date().toISOString() }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.mocked(importSpec).mockResolvedValue(result);
    const user = await uploadAndImport();

    await user.click(await screen.findByRole("button", { name: "Use this plan" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").draft.name).toBe("My old plan");
  });
});