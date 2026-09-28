"use client";

import { useEffect, useState } from "react";
import { apiFetch, API_URL } from "@/lib/api";

type Health = { status: string; database: string };

export default function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Health>("/api/health")
      .then(setHealth)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <h1 className="text-4xl font-semibold tracking-tight">DevSync</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        One view of your project plan, GitHub activity, and Discord discussion.
      </p>
      <div className="rounded-lg border border-zinc-200 p-4 font-mono text-sm dark:border-zinc-800">
        <div>Backend: {API_URL}</div>
        {health && (
          <div className="text-green-600">
            API {health.status} · database {health.database}
          </div>
        )}
        {error && <div className="text-red-600">Unreachable ({error})</div>}
        {!health && !error && <div className="text-zinc-500">Checking…</div>}
      </div>
    </main>
  );
}
