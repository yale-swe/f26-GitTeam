import type { Metadata } from "next";
import GitHubCallback from "@/components/GitHubCallback/GitHubCallback";

export const metadata: Metadata = { title: "Connect GitHub · DevSync" };

// GitHub redirects here after the user installs the DevSync app.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; installation_id?: string; state?: string; setup_action?: string }>;
}) {
  const params = await searchParams;
  return (
    <GitHubCallback
      projectId={params.state}
      installationId={params.installation_id}
      code={params.code}
      setupAction={params.setup_action}
    />
  );
}
