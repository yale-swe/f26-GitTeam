import type { Metadata } from "next";
import ProjectsOverview from "@/components/ProjectsOverview/ProjectsOverview";
import { mockDashboard } from "@/lib/mockDashboard";

export const metadata: Metadata = { title: "Projects · DevSync" };

export default function Page() {
  return <ProjectsOverview dashboards={[mockDashboard]} />;
}
