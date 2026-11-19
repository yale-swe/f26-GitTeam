import type { Metadata } from "next";
import ProjectReview from "@/components/ProjectReview/ProjectReview";

export const metadata: Metadata = { title: "Review and create · DevSync" };

export default function Page() {
  return <ProjectReview />;
}
