import AccountMenu from "@/components/AccountMenu/AccountMenu";
import Icon, { type IconName } from "@/components/Icon/Icon";
import styles from "./Sidebar.module.css";
import Link from "next/link";
import type { IntegrationStatus } from "@/lib/types";
import { syncStatusToDot } from "@/lib/dashboardFormat";

export type NavKey = "projects" | "health" | "milestones";
// Removed for the MVP version: | "pullRequests" | "teamContext" 

const navItems: { key: NavKey; label: string; icon: IconName; activeIcon: IconName; href?: string }[] = [
  { key: "projects", label: "Projects", icon: "grid-16-gray", activeIcon: "grid-16-blue", href: "/projects" },
  { key: "health", label: "Health", icon: "activity-16-gray", activeIcon: "activity-16-blue", href: "/health" },
  { key: "milestones", label: "Milestones", icon: "milestone-16-gray", activeIcon: "milestone-16-blue", href: "/milestones" },
  // Removed for the MVP version:
  // {
  //   key: "pullRequests",
  //   label: "Pull requests",
  //   icon: "git-pull-request-16-gray",
  //   activeIcon: "git-pull-request-16-gray",
  // },
  // {
  //   key: "teamContext",
  //   label: "Team context",
  //   icon: "message-square-16-gray",
  //   activeIcon: "message-square-16-gray",
  // },
];

type SidebarProps = {
  active: NavKey;
  // The project switcher and connection list only appear once a project exists.
  showProjectContext?: boolean;
  projectName?: string;
  integrations?: IntegrationStatus[];
};

export default function Sidebar({ active, showProjectContext = true, projectName, integrations = [] }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>D</span>
        <p className={styles.brandName}>DevSync</p>
      </div>

      {showProjectContext && (
        <div className={styles.projectSwitcher}>
          <p className={styles.overline}>Current project</p>
          <div className={styles.selection}>
            <p>{projectName ?? "No project selected"}</p>
            <Icon name="chevron-down-14-gray" />
          </div>
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

          // Removed for the MVP version:
          // Pages that don't exist yet stay as plain, non-clickable items
          // if (!item.href) {
          //   return (
          //     <div key={item.key} className={`${className} ${styles.navItemDisabled}`}>
          //       {content}
          //     </div>
          //   );
          // }

          return (
            <Link
              key={item.key}
              href={item.href}
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
