import "@testing-library/jest-dom/vitest";

// Supabase clients throw without these; real values are never used in tests.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
