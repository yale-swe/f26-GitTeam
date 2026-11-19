import type { ReactNode } from "react";
import Sidebar, { type NavKey, type ProjectOption } from "@/components/Sidebar/Sidebar";
import styles from "./AppShell.module.css";
import type { IntegrationStatus } from "@/lib/types";

type AppShellProps = {
  children: ReactNode;
  activeNav: NavKey;
  showConnections?: boolean;
  showProjectContext?: boolean;
  projectId?: string;
  projectName?: string;
  projects?: ProjectOption[];
  integrations?: IntegrationStatus[];
};

export default function AppShell({
  children,
  activeNav,
  showConnections,
  showProjectContext,
  projectId,
  projectName,
  projects,
  integrations,
}: AppShellProps) {
  return (
    <div className={styles.shell}>
      <Sidebar
        active={activeNav}
        showProjectContext={showProjectContext}
        showConnections={showConnections}
        projectId={projectId}
        projectName={projectName}
        projects={projects}
        integrations={integrations}
      />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
