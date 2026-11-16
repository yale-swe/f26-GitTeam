import type { Metadata } from "next";
import SpecImport from "@/components/SpecImport/SpecImport";

export const metadata: Metadata = { title: "Import specification · DevSync" };

export default function Page() {
  return <SpecImport />;
}