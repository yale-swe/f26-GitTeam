import type { Metadata } from "next";
import ProjectHealth from "@/components/ProjectHealth/ProjectHealth";
import { mockDashboard } from "@/lib/mockDashboard";

export const metadata: Metadata = { title: "Project health · DevSync" };

export default function Page() {
  return <ProjectHealth dashboard={mockDashboard} />;
}
