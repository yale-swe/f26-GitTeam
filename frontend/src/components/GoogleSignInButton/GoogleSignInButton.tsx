"use client";

import { useState } from "react";
import Button from "@/components/Button/Button";
import styles from "./GoogleSignInButton.module.css";
import { createClient } from "@/lib/supabase/client";

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

type Props = {
  // Same-origin path to open after sign-in; validated again in the callback.
  next?: string;
  variant?: "primary" | "secondary";
  size?: "default" | "large";
  fullWidth?: boolean;
  color?: SignInColor;
  onSignInClick?: () => void;
};

export type SignInColor = "blue" | "green" | "dark";

export default function GoogleSignInButton({ next, variant = "secondary", size, fullWidth, color = "blue", onSignInClick, }: Props) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signIn() {
    onSignInClick?.();
    setPending(true);
    setFailed(false);
    const redirectTo = new URL("/auth/callback", window.location.origin);
    if (next) redirectTo.searchParams.set("next", next);

    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString() },
    });
    // On success the browser navigates to Google, so only errors land here.
    if (error) {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <div className={styles.root}>
      <Button variant={variant} size={size} fullWidth={fullWidth} onClick={signIn} disabled={pending} className={color === "blue" ? undefined : styles[color]}>
        <GoogleMark />
        {pending ? "Redirecting…" : "Sign in with Google"}
      </Button>
      {failed && (
        <p role="alert" className={styles.error}>
          Couldn&rsquo;t start Google sign-in. Please try again.
        </p>
      )}
    </div>
  );
}
