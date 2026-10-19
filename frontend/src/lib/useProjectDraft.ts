"use client";

import { useCallback, useEffect, useState } from "react";

import { emptyDraft, type PlanDraft } from "./projectDraft";

const STORAGE_KEY = "devsync.projectDraft.v1";

type StoredDraft = {
  draft: PlanDraft;
  savedAt: string;
};

export type UseProjectDraft = {
  draft: PlanDraft;
  setDraft: (next: PlanDraft) => void;
  /** Shallow-merge a patch into the current draft. */
  updateDraft: (patch: Partial<PlanDraft>) => void;
  /** When the draft was last written to storage, or null if never. */
  lastSavedAt: Date | null;
  /** True once a persisted draft has been found or written. */
  hasSavedDraft: boolean;
  /** True after the mount-time read from localStorage has run. */
  hydrated: boolean;
  /** Explicitly bump the saved timestamp (content is already auto-persisted). */
  saveDraft: () => void;
  /** Clear the stored draft and reset to an empty plan. */
  discardDraft: () => void;
};

/**
 * Holds the onboarding draft in React state and mirrors it to localStorage so
 * data survives navigation between setup steps and page reloads. Reading from
 * storage happens in an effect to avoid an SSR/CSR hydration mismatch; the
 * "saved" timestamp is updated by the mutators so the persist effect stays a
 * pure write-to-external-system with no cascading setState.
 */
export function useProjectDraft(): UseProjectDraft {
  const [draft, setDraftState] = useState<PlanDraft>(emptyDraft);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load any previously saved draft once, on mount. Reading localStorage here
  // (rather than in a lazy initializer) keeps the first client render identical
  // to the server render, avoiding a hydration mismatch.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration read from localStorage */
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredDraft;
        if (parsed?.draft) {
          setDraftState(parsed.draft);
          setHasSavedDraft(true);
          setLastSavedAt(parsed.savedAt ? new Date(parsed.savedAt) : null);
        }
      }
    } catch {
      // Ignore unreadable or corrupt storage.
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Mirror the draft to storage on every change, but only after the initial
  // load so we never overwrite a stored draft with the empty seed. This effect
  // writes to an external system only and does not call setState.
  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: StoredDraft = { draft, savedAt: new Date().toISOString() };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage write failures (e.g. private mode quota).
    }
  }, [draft, hydrated]);

  const markSaved = useCallback(() => {
    setLastSavedAt(new Date());
    setHasSavedDraft(true);
  }, []);

  const setDraft = useCallback(
    (next: PlanDraft) => {
      setDraftState(next);
      markSaved();
    },
    [markSaved],
  );

  const updateDraft = useCallback(
    (patch: Partial<PlanDraft>) => {
      setDraftState((prev) => ({ ...prev, ...patch }));
      markSaved();
    },
    [markSaved],
  );

  const saveDraft = useCallback(() => {
    markSaved();
  }, [markSaved]);

  const discardDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore.
    }
    setDraftState(emptyDraft());
    setHasSavedDraft(false);
    setLastSavedAt(null);
  }, []);

  return {
    draft,
    setDraft,
    updateDraft,
    lastSavedAt,
    hasSavedDraft,
    hydrated,
    saveDraft,
    discardDraft,
  };
}
