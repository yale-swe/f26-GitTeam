import GoogleSignInButton from "@/components/GoogleSignInButton/GoogleSignInButton";
import { safeNextPath } from "@/lib/authRedirect";

export const metadata = { title: "Sign in · DevSync" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Sign in to DevSync</h1>
        <p className="mt-2 text-zinc-600">
          Use your Google account to see your project dashboard.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Sign-in failed. Please try again.
        </p>
      )}
      <GoogleSignInButton variant="primary" fullWidth next={next ? safeNextPath(next) : undefined} />
    </main>
  );
}
