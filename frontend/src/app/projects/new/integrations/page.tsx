import type { Metadata } from "next";
import ConnectIntegrations from "@/components/ConnectIntegrations/ConnectIntegrations";

export const metadata: Metadata = { title: "Connect integrations · DevSync" };

export default function Page() {
  return <ConnectIntegrations />;
}
