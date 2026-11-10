import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Used for sign-in/out and reading the session
// access token that apiFetch forwards to the FastAPI backend.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
