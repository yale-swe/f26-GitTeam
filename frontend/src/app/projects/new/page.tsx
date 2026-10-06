import type { Metadata } from "next";
import CreateProject from "@/components/CreateProject/CreateProject";

export const metadata: Metadata = { title: "New project · DevSync" };

export default function Page() {
  return <CreateProject />;
}
