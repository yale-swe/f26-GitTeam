import type { ReactNode } from "react";
import Sidebar, { type NavKey } from "@/components/Sidebar/Sidebar";
import styles from "./AppShell.module.css";
import type { IntegrationStatus } from "@/lib/types";

type AppShellProps = {
  children: ReactNode;
  activeNav: NavKey;
  showProjectContext?: boolean;
  projectName?: string;
  integrations?: IntegrationStatus[];
};

export default function AppShell({ children, activeNav, showProjectContext, projectName, integrations }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <Sidebar active={activeNav} showProjectContext={showProjectContext} projectName={projectName} integrations={integrations} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
