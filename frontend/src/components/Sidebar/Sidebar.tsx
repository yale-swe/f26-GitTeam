import Avatar from "@/components/Avatar/Avatar";
import Icon, { type IconName } from "@/components/Icon/Icon";
import styles from "./Sidebar.module.css";

export type NavKey = "projects" | "health" | "milestones" | "pullRequests" | "teamContext";

const navItems: { key: NavKey; label: string; icon: IconName; activeIcon: IconName }[] = [
  { key: "projects", label: "Projects", icon: "grid-16-gray", activeIcon: "grid-16-blue" },
  { key: "health", label: "Health", icon: "activity-16-gray", activeIcon: "activity-16-blue" },
  { key: "milestones", label: "Milestones", icon: "milestone-16-gray", activeIcon: "milestone-16-blue" },
  {
    key: "pullRequests",
    label: "Pull requests",
    icon: "git-pull-request-16-gray",
    activeIcon: "git-pull-request-16-gray",
  },
  {
    key: "teamContext",
    label: "Team context",
    icon: "message-square-16-gray",
    activeIcon: "message-square-16-gray",
  },
];

type SidebarProps = {
  active: NavKey;
  // The project switcher and connection list only appear once a project exists.
  showProjectContext?: boolean;
};

export default function Sidebar({ active, showProjectContext = true }: SidebarProps) {
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
            <p>Campus Cart</p>
            <Icon name="chevron-down-14-gray" />
          </div>
        </div>
      )}

      <nav className={styles.nav}>
        {navItems.map((item) => {
          const isActive = item.key === active;
          return (
            <div key={item.key} className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}>
              <Icon name={isActive ? item.activeIcon : item.icon} />
              <p>{item.label}</p>
            </div>
          );
        })}
      </nav>

      <div className={styles.spacer} />

      {showProjectContext && (
        <div className={styles.connections}>
          <p className={styles.overline}>Connected</p>
          <div className={styles.connection}>
            <Icon name="github-14-gray" />
            <p>GitHub</p>
            <Icon name="dot-6-green" />
          </div>
          <div className={styles.connection}>
            <Icon name="hash-14-gray" />
            <p>Discord</p>
            <Icon name="dot-6-green" />
          </div>
        </div>
      )}

      <div className={styles.account}>
        <Avatar initials="AM" />
        <div className={styles.user}>
          <p className={styles.userName}>Alex Morgan</p>
          <p className={styles.userRole}>Project lead</p>
        </div>
        <Icon name="settings-15-gray" />
      </div>
    </aside>
  );
}
