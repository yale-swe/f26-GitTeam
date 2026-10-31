import AppShell from "@/components/AppShell/AppShell";
import Avatar from "@/components/Avatar/Avatar";
import Button from "@/components/Button/Button";
import Icon, { type IconName } from "@/components/Icon/Icon";
import PageHeader from "@/components/PageHeader/PageHeader";
import ProgressBar from "@/components/ProgressBar/ProgressBar";
import SectionHeader from "@/components/SectionHeader/SectionHeader";
import StatusPill from "@/components/StatusPill/StatusPill";
import styles from "./ProjectsOverview.module.css";

const summary: { label: string; value: string; note: string; dot: IconName }[] = [
  { label: "Active projects", value: "4", note: "Across 3 repositories", dot: "dot-7-blue" },
  { label: "On track", value: "2", note: "50% of portfolio", dot: "dot-7-green" },
  { label: "Needs review", value: "2", note: "1 deadline this week", dot: "dot-7-amber" },
  { label: "Open blockers", value: "3", note: "2 awaiting an owner", dot: "dot-7-amber" },
];

type Project = {
  mark: string;
  name: string;
  status: { label: string; tone: "green" | "amber" | "red" };
  description: string;
  progress: number;
  // Filled segments as drawn in the wireframe (not always progress / 10).
  segments: number;
  milestone: string;
  deadline: string;
  deadlineOverdue?: boolean;
  activity: string;
  contributors: string[];
};

const projects: Project[] = [
  {
    mark: "CC",
    name: "Campus Cart",
    status: { label: "On track", tone: "green" },
    description: "Marketplace for students to trade used textbooks and dorm essentials.",
    progress: 68,
    segments: 7,
    milestone: "Beta checkout",
    deadline: "Oct 18",
    activity: "3 PRs merged · 2 decisions",
    contributors: ["AM", "JK", "SR"],
  },
  {
    mark: "SS",
    name: "StudySpace",
    status: { label: "Needs attention", tone: "amber" },
    description: "Find and reserve quiet study rooms across campus buildings.",
    progress: 47,
    segments: 5,
    milestone: "Booking flow",
    deadline: "Oct 12",
    activity: "1 blocker raised · 5 commits",
    contributors: ["MK", "LP", "AM"],
  },
  {
    mark: "CH",
    name: "ClubHub",
    status: { label: "At risk", tone: "red" },
    description: "Student organization directory, events, and membership portal.",
    progress: 31,
    segments: 4,
    milestone: "Events API",
    deadline: "Oct 09",
    deadlineOverdue: true,
    activity: "No activity in 4 days",
    contributors: ["TN", "SR"],
  },
  {
    mark: "CM",
    name: "CourseMap",
    status: { label: "On track", tone: "green" },
    description: "Visual prerequisite planner for computer science degree paths.",
    progress: 82,
    segments: 9,
    milestone: "Accessibility pass",
    deadline: "Oct 24",
    activity: "7 commits · 1 PR open",
    contributors: ["JK", "LP", "TN"],
  },
];

export default function ProjectsOverview() {
  return (
    <AppShell activeNav="projects">
      <PageHeader
        title="Projects"
        description="Monitor delivery health, deadlines, and team activity across your workspace."
        actions={
          <Button variant="primary" icon="plus-15-white" href="/projects/new">
            New project
          </Button>
        }
      />

      < div className={styles.summaryRow} >
        {
          summary.map((item) => (
            <div key={item.label} className={styles.summaryCard}>
              <div className={styles.summaryLabel}>
                <p>{item.label}</p>
                <Icon name={item.dot} />
              </div>
              <p className={styles.summaryValue}>{item.value}</p>
              <p className={styles.summaryNote}>{item.note}</p>
            </div>
          ))
        }
      </div >

      <div className={styles.projectsSection}>
        <SectionHeader
          title="All projects"
          description="Sorted by most recently active"
          action="Filter: All health"
        />
        <div className={styles.projectGrid}>
          {projects.map((project) => (
            <ProjectCard key={project.name} project={project} />
          ))}
        </div>
      </div>
    </AppShell >
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <article className={styles.projectCard}>
      <div className={styles.projectHeading}>
        <div className={styles.identity}>
          <span className={styles.projectMark}>{project.mark}</span>
          <div className={styles.projectCopy}>
            <p className={styles.projectName}>{project.name}</p>
            <p className={styles.updated}>Updated 18 minutes ago</p>
          </div>
        </div>
        <StatusPill tone={project.status.tone} dot>
          {project.status.label}
        </StatusPill>
      </div>

      <p className={styles.projectDescription}>{project.description}</p>

      <div className={styles.progress}>
        <div className={styles.progressLabel}>
          <p>Plan progress</p>
          <p className={styles.progressValue}>{project.progress}%</p>
        </div>
        <ProgressBar filled={project.segments} />
      </div>

      <div className={styles.facts}>
        <div className={`${styles.fact} ${styles.factGrow}`}>
          <p className={styles.factLabel}>Next milestone</p>
          <p className={styles.factValue}>{project.milestone}</p>
        </div>
        <div className={`${styles.fact} ${styles.factDeadline}`}>
          <p className={styles.factLabel}>Deadline</p>
          <p className={`${styles.factValue} ${project.deadlineOverdue ? styles.overdue : ""}`}>
            {project.deadline}
          </p>
        </div>
      </div>

      <div className={styles.recentActivity}>
        <div className={styles.activity}>
          <Icon name="activity-14-gray" />
          <p>{project.activity}</p>
        </div>
        <div className={styles.contributors}>
          {project.contributors.map((initials, i) => (
            <Avatar key={initials} initials={initials} tone={i === 0 ? "dark" : "light"} size={26} ring />
          ))}
        </div>
      </div>
    </article>
  );
}
