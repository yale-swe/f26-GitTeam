import type { Metadata } from "next";
import SpecImportReview from "@/components/SpecImportReview/SpecImportReview";

export const metadata: Metadata = { title: "Review imported plan · DevSync" };

export default function Page() {
  return <SpecImportReview />;
}
