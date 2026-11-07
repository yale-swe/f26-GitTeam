import { createClient } from "@/lib/supabase/client";
import type { Dashboard, Project } from "@/lib/types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function accessToken(): Promise<string | null> {
  // Only the browser holds the Supabase session.
  if (typeof window === "undefined") return null;
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = await accessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (res.status === 401 && typeof window !== "undefined") {
    // Full reload so no signed-in client state survives.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** Projects the signed-in user is a member of. */
export function listProjects() {
  return apiFetch<Project[]>("/api/projects");
}

/** Everything the project-health page needs, including the calculated health score. */
export function getDashboard(projectId: string) {
  return apiFetch<Dashboard>(`/api/projects/${projectId}/dashboard`);
}