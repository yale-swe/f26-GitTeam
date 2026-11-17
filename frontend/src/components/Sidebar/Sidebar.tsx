import AccountMenu from "@/components/AccountMenu/AccountMenu";
import Icon, { type IconName } from "@/components/Icon/Icon";
import ProjectSwitcher from "@/components/ProjectSwitcher/ProjectSwitcher";
import styles from "./Sidebar.module.css";
import Link from "next/link";
import type { IntegrationStatus, Project } from "@/lib/types";
import { syncStatusToDot } from "@/lib/dashboardFormat";

export type NavKey = "projects" | "health" | "milestones";

export type ProjectOption = Pick<Project, "id" | "name">;

// Project pages keep the selected project; the Projects list covers every project.
function navHref(item: { key: NavKey; href: string }, projectId?: string) {
  return projectId && item.key !== "projects" ? `${item.href}?project=${projectId}` : item.href;
}

const navItems: { key: NavKey; label: string; icon: IconName; activeIcon: IconName; href: string }[] = [
  { key: "projects", label: "Projects", icon: "grid-16-gray", activeIcon: "grid-16-blue", href: "/projects" },
  { key: "health", label: "Health", icon: "activity-16-gray", activeIcon: "activity-16-blue", href: "/health" },
  { key: "milestones", label: "Milestones", icon: "milestone-16-gray", activeIcon: "milestone-16-blue", href: "/milestones" },
];

type SidebarProps = {
  active: NavKey;
  // The project switcher and connection list only appear once a project exists.
  showProjectContext?: boolean;
  projectId?: string;
  projectName?: string;
  /** Projects offered by the switcher. Without them the current project is shown as plain text. */
  projects?: ProjectOption[];
  integrations?: IntegrationStatus[];
};

export default function Sidebar({
  active,
  showProjectContext = true,
  projectId,
  projectName,
  projects,
  integrations = [],
}: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>D</span>
        <p className={styles.brandName}>DevSync</p>
      </div>

      {showProjectContext && (
        <div className={styles.projectSwitcher}>
          <p className={styles.overline}>Current project</p>
          <ProjectSwitcher active={active} projectId={projectId} projectName={projectName} projects={projects} />
        </div>
      )}

      <nav className={styles.nav}>
        {navItems.map((item) => {
          const isActive = item.key === active;
          const className = `${styles.navItem} ${isActive ? styles.navItemActive : ""}`;
          const content = (
            <>
              <Icon name={isActive ? item.activeIcon : item.icon} />
              <p>{item.label}</p>
            </>
          );

          return (
            <Link
              key={item.key}
              href={navHref(item, projectId)}
              className={className}
              aria-current={isActive ? "page" : undefined}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      <div className={styles.spacer} />

      {showProjectContext && (
        <div className={styles.connections}>
          <p className={styles.overline}>Connected</p>
          {integrations.length === 0 ? (
            <p className={styles.connection}>None connected</p>
          ) : (
            integrations.map((integration) => (
              <div key={integration.provider} className={styles.connection}>
                <Icon name={integration.provider === "github" ? "github-14-gray" : "hash-14-gray"} />
                <p>{integration.provider === "github" ? "GitHub" : "Discord"}</p>
                <Icon name={syncStatusToDot(integration.status)} />
              </div>
            ))
          )}
        </div>
      )}

      <AccountMenu />
    </aside>
  );
}
