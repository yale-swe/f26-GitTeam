import type { Metadata } from "next";
import MilestoneDetail from "@/components/MilestoneDetail/MilestoneDetail";

export const metadata: Metadata = { title: "Beta checkout · DevSync" };

export default function Page() {
  return <MilestoneDetail />;
}
