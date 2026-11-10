import type { Metadata } from "next";
import ProjectsLoader from "@/components/ProjectsLoader/ProjectsLoader";

export const metadata: Metadata = { title: "Projects · DevSync" };

export default function Page() {
  return <ProjectsLoader />;
}
