import type { Metadata } from "next";
import ProjectHealth from "@/components/ProjectHealth/ProjectHealth";

export const metadata: Metadata = { title: "Project health · DevSync" };

export default function Page() {
  return <ProjectHealth />;
}
