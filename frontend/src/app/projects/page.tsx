import type { Metadata } from "next";
import ProjectsOverview from "@/components/ProjectsOverview/ProjectsOverview";

export const metadata: Metadata = { title: "Projects · DevSync" };

export default function Page() {
  return <ProjectsOverview />;
}
