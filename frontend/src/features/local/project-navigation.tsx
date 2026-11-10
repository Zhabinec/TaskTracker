"use client";

import { useRef, useState } from "react";
import type { Project } from "./contracts";
import { ProjectComposer } from "./project-composer";
import { WorkspaceBackupControls } from "./workspace-backup";
import { Icon } from "@/shared/ui/icon";
import styles from "./local.module.css";

type Props = {
  projects: Project[];
  selected: string;
  archived: boolean;
  more: boolean;
  onSelect: (id: string) => void;
  onToggleArchive: () => void;
  onMore: () => void;
  onCreated: (project: Project) => void;
};

export function ProjectNavigation({ projects, selected, archived, more, onSelect, onToggleArchive, onMore, onCreated }: Props) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  // Keep the first-project form available, then collapse secondary management on phones.
  const showManagement = expanded || !projects.length;
  return <aside className={`glass ${styles.sidebar}`} aria-label="Projects">
    <div className={styles.mobileProjectBar}>
      <select className={styles.statusSelect} aria-label="Current project" value={selected} onChange={event => onSelect(event.target.value)} disabled={!projects.length}>
        {!projects.length && <option value="">{archived ? "Archived projects" : "No projects"}</option>}
        {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
      <button ref={toggle} type="button" className={`icon-button ${styles.textAction}`} aria-label="Manage" title="Manage projects" aria-expanded={showManagement} aria-controls="project-management" onClick={() => setExpanded(value => !value)}><Icon name="settings" /></button>
    </div>
    <div id="project-management" className={showManagement ? styles.projectManagement : `${styles.projectManagement} ${styles.managementCollapsed}`}>
      <div className={styles.sectionLabel}><h2>{archived ? "Archived" : "My projects"}</h2><span>{projects.length}{more ? "+" : ""}</span></div>
      <button type="button" className={styles.textAction} onClick={onToggleArchive}><Icon name={archived ? "folder" : "archive"} />{archived ? "Active projects" : "Archived projects"}</button>
      <div className={styles.projectList}>{projects.map(project => <button key={project.id} className={styles.project} aria-pressed={selected === project.id} onClick={() => onSelect(project.id)}>
        <span className={styles.dot} data-color={project.color} aria-hidden="true" /><span className={styles.projectName}>{project.name}</span><span className={styles.projectCount}>{project.taskCount}</span>
      </button>)}</div>
      {more && <button className={`secondary ${styles.loadMore}`} onClick={onMore}>More projects</button>}
      <ProjectComposer onAdded={project => {
        if (window.matchMedia("(max-width: 900px)").matches) toggle.current?.focus();
        setExpanded(false); onCreated(project);
      }} />
      <WorkspaceBackupControls />
    </div>
  </aside>;
}
