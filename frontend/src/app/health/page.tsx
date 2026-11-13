import type { Metadata } from "next";
import { Suspense } from "react";
import HealthDashboardLoader from "@/components/HealthDashboardLoader/HealthDashboardLoader";

export const metadata: Metadata = { title: "Project health · DevSync" };

export default function Page() {
  return (
    <Suspense>
      <HealthDashboardLoader />
    </Suspense>
  );
}
