import type { Metadata } from "next";
import { Suspense } from "react";
import MilestoneLoader from "@/components/MilestoneLoader/MilestoneLoader";

export const metadata: Metadata = { title: "Milestone · DevSync" };

export default function Page() {
  return (
    <Suspense>
      <MilestoneLoader />
    </Suspense>
  );
}
