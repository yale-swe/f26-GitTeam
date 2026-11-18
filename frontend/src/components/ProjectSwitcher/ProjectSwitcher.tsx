"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import type { NavKey, ProjectOption } from "@/components/Sidebar/Sidebar";
import styles from "./ProjectSwitcher.module.css";

type ProjectSwitcherProps = {
  active: NavKey;
  projectId?: string;
  projectName?: string;
  projects?: ProjectOption[];
};

// Milestones stays on milestones; Health and Projects both open the chosen project's health page.
function hrefFor(active: NavKey, projectId: string) {
  return active === "milestones" ? `/milestones?project=${projectId}` : `/health?project=${projectId}`;
}

export default function ProjectSwitcher({ active, projectId, projectName, projects = [] }: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const label = projectName ?? "No project selected";

  if (projects.length === 0) {
    return (
      <div className={styles.selection}>
        <p>{label}</p>
        <Icon name="chevron-down-14-gray" />
      </div>
    );
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={styles.selection}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        <p>{label}</p>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}>
          <Icon name="chevron-down-14-gray" />
        </span>
      </button>
      {open && (
        <ul id={listId} className={styles.menu} aria-label="Switch project">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={hrefFor(active, project.id)}
                className={`${styles.option} ${project.id === projectId ? styles.optionCurrent : ""}`}
                aria-current={project.id === projectId ? "true" : undefined}
                onClick={() => setOpen(false)}
              >
                {project.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
