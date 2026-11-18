import type { Metadata } from "next";
import { Suspense } from "react";
import MilestonesLoader from "@/components/MilestonesLoader/MilestonesLoader";

export const metadata: Metadata = { title: "Milestones · DevSync" };

export default function Page() {
  return (
    <Suspense>
      <MilestonesLoader />
    </Suspense>
  );
}
