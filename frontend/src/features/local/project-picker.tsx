"use client";

import { useEffect, useState } from "react";
import type { Project } from "./contracts";
import { getProject, listProjects, subscribeChanges } from "./store";
import styles from "./local.module.css";

export function ProjectPicker({ value, label, onChange, disabled = false }: { value: string; label: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [projects, setProjects] = useState<Project[]>([]); const [limit, setLimit] = useState(50);
  const [more, setMore] = useState(false); const [revision, setRevision] = useState(0); const [error, setError] = useState("");
  useEffect(() => subscribeChanges(() => setRevision(count => count + 1)), []);
  useEffect(() => {
    let active = true;
    Promise.all([listProjects(limit, "active"), value ? getProject(value) : Promise.resolve(undefined)]).then(([page, selected]) => {
      if (!active) return;
      setProjects(selected && !page.items.some(project => project.id === selected.id) ? [selected, ...page.items] : page.items);
      setMore(page.more); setError("");
    }).catch(() => { if (active) setError("Projects unavailable. Retry by reopening this form."); });
    return () => { active = false; };
  }, [limit, revision, value]);
  return <><select className={styles.statusSelect} aria-label={label} value={value} onChange={event => onChange(event.target.value)} disabled={disabled || Boolean(error)}>
    <option value="">Choose project</option>{projects.map(project => <option key={project.id} value={project.id} disabled={project.state === "archived"}>{project.name}{project.state === "archived" ? " (archived)" : ""}</option>)}
  </select>{more && <button type="button" className={styles.textAction} disabled={disabled} onClick={() => setLimit(count => count + 50)}>More destinations</button>}
  {error && <span className="form-error" role="alert">{error}</span>}</>;
}
