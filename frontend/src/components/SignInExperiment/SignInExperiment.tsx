"use client";

import { useEffect, useState } from "react";
import GoogleSignInButton, { type SignInColor } from "@/components/GoogleSignInButton/GoogleSignInButton";
import { assignVariant, recordConversion } from "@/lib/api";

export const SIGNIN_EXPERIMENT = "landing-signin-color";
const COLORS: SignInColor[] = ["blue", "green", "dark"];
const STORAGE_KEY = `experiment:${SIGNIN_EXPERIMENT}`;

function isColor(value: unknown): value is SignInColor {
    return COLORS.includes(value as SignInColor);
}

function readSavedColor(): SignInColor | null {
    try {
        const saved = window.sessionStorage.getItem(STORAGE_KEY);
        return isColor(saved) ? saved : null;
    } catch {
        return null; // storage blocked (e.g. private mode)
    }
}

function saveColor(color: SignInColor) {
    try {
        window.sessionStorage.setItem(STORAGE_KEY, color);
    } catch {
        // Not critical: the visitor may just be counted again on reload.
    }
}

/** Keep the same color for this visitor's session, so a reload doesn't count a new view. */
async function fetchColor(): Promise<SignInColor | null> {
    const saved = readSavedColor();
    if (saved) return saved;
    const { variant } = await assignVariant(SIGNIN_EXPERIMENT);
    if (!isColor(variant)) return null;
    saveColor(variant);
    return variant;
}

// The request currently in progress, if any. In development React runs effects twice;
// sharing one request means the visitor is still counted only once.
let pendingColor: Promise<SignInColor | null> | null = null;

function loadColor(): Promise<SignInColor | null> {
    pendingColor ??= fetchColor().finally(() => {
        pendingColor = null;
    });
    return pendingColor;
}

/**
 * The landing page's main "Sign in with Google" button, in one of three colors.
 * The backend's multi-armed bandit picks the color; a click counts as a conversion.
 */
// How long to wait for the backend before showing the normal button anyway.
const MAX_WAIT_MS = 1500;

export default function SignInExperiment() {
    // "loading": waiting for the backend; the button is invisible but keeps its space.
    // A color: show it and track clicks. "fallback": show the normal blue button, no tracking.
    const [state, setState] = useState<SignInColor | "loading" | "fallback">("loading");

    useEffect(() => {
        let settled = false;
        const settle = (next: SignInColor | "fallback") => {
            if (settled) return;
            settled = true;
            setState(next);
        };
        const timer = setTimeout(() => settle("fallback"), MAX_WAIT_MS);
        loadColor()
            .then((loaded) => settle(loaded ?? "fallback"))
            .catch(() => settle("fallback"));
        return () => {
            settled = true; // ignore results after the component is gone
            clearTimeout(timer);
        };
    }, []);

    const isTracked = state !== "loading" && state !== "fallback";

    function handleClick() {
        if (isTracked) recordConversion(SIGNIN_EXPERIMENT, state).catch(() => { });
    }

    return (
        <div style={state === "loading" ? { visibility: "hidden" } : undefined}>
            <GoogleSignInButton
                variant="primary"
                size="large"
                color={isTracked ? state : "blue"}
                onSignInClick={handleClick}
            />
        </div>
    );
}