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
export default function SignInExperiment() {
    // null until the backend answers; the normal blue button shows meanwhile.
    const [color, setColor] = useState<SignInColor | null>(null);

    useEffect(() => {
        let cancelled = false;
        loadColor()
            .then((loaded) => {
                if (!cancelled) setColor(loaded);
            })
            .catch(() => {
                // Experiment unavailable: keep the default button and don't track clicks.
            });
        return () => {
            cancelled = true;
        };
    }, []);

    function handleClick() {
        if (color) recordConversion(SIGNIN_EXPERIMENT, color).catch(() => { });
    }

    return (
        <GoogleSignInButton variant="primary" size="large" color={color ?? "blue"} onSignInClick={handleClick} />
    );
}