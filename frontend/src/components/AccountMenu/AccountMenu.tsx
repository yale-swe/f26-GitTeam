"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar/Avatar";
import styles from "@/components/Sidebar/Sidebar.module.css";
import { createClient } from "@/lib/supabase/client";

type Profile = { name: string; email: string };

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  );
}

export default function AccountMenu() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const user = data.user;
        if (!user) return;
        const email = user.email ?? "";
        const name = (user.user_metadata?.full_name as string | undefined) ?? email;
        setProfile({ name, email });
      });
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    // Full reload so no signed-in client state survives.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  }

  return (
    <div className={styles.account}>
      <Avatar initials={profile ? initialsOf(profile.name) : "…"} />
      <div className={styles.user}>
        <p className={styles.userName}>{profile?.name ?? "Loading…"}</p>
        <button type="button" className={styles.userRole} onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
