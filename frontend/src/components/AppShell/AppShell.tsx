import type { ReactNode } from "react";
import Sidebar, { type NavKey } from "@/components/Sidebar/Sidebar";
import styles from "./AppShell.module.css";

type AppShellProps = {
  children: ReactNode;
  activeNav: NavKey;
  showProjectContext?: boolean;
};

export default function AppShell({ children, activeNav, showProjectContext }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <Sidebar active={activeNav} showProjectContext={showProjectContext} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
