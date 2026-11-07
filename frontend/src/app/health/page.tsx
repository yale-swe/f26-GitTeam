import type { Metadata } from "next";
import HealthDashboardLoader from "@/components/HealthDashboardLoader/HealthDashboardLoader";

export const metadata: Metadata = { title: "Project health · DevSync" };

export default function Page() {
  return <HealthDashboardLoader />;
}
