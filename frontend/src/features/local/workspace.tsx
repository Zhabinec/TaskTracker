"use client";
import { useEffect, useRef, useState } from "react";
import type { DueFilter, LocalProfile, Project, TaskStatus } from "./contracts";
import { getProject, listProjects, profile, subscribeChanges } from "./store";
import styles from "./local.module.css";
import { useTaskQuery } from "./use-task-query";
import { ProjectSettings } from "./project-settings";
import { SavedDrafts } from "./saved-drafts";
import { ProjectComposer } from "./project-composer";
import type { Draft } from "./draft-contracts";
import { TaskList } from "./task-list";
import { WorkspaceBackupControls } from "./workspace-backup";
import { TaskComposer } from "./task-composer";
import { statusLabels as labels } from "./contracts";

function friendlyError(cause: unknown) { return cause instanceof Error ? cause.message : "Something went wrong. Please retry."; }

export function LocalWorkspace() {
  const [owner, setOwner] = useState<LocalProfile>(); const [projects, setProjects] = useState<Project[]>([]);
  const [archived, setArchived] = useState(false); const [currentProject, setCurrentProject] = useState<Project>();
  const [selected, setSelected] = useState(""); const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [projectLimit, setProjectLimit] = useState(50);
  const [search, setSearch] = useState(""); const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [moreProjects, setMoreProjects] = useState(false); const [revision, setRevision] = useState(0);

  const [error, setError] = useState("");
  const [resumed, setResumed] = useState<Draft>();
  const restoredView = useRef(false);
  const [notice, setNotice] = useState<{ text: string; scope: string; status?: TaskStatus; projectId?: string }>();
  const taskPage = useTaskQuery(selected, filter, search, dueFilter, revision);
  useEffect(() => subscribeChanges(() => setRevision(value => value + 1)), []);
  useEffect(() => {
    let active = true;
    let preferred = selected; let showingArchive = archived; let restoredFilter: TaskStatus | "all" = "all";
    const restoreView = !restoredView.current;
    if (restoreView) {
      try { const view = JSON.parse(sessionStorage.getItem("tasktracker:view") ?? "null"); if (view) { preferred = view.projectId || ""; showingArchive = Boolean(view.archived); if (["all", "Todo", "InProgress", "Done"].includes(view.filter)) restoredFilter = view.filter; } } catch { /* View settings are optional. */ }
    }
    Promise.all([profile(), listProjects(projectLimit, showingArchive ? "archived" : "active"), preferred ? getProject(preferred) : Promise.resolve(undefined)]).then(([value, page, pinned]) => {
      if (!active) return;
      if (!value) { window.location.replace("/login"); return; }
      if (restoreView) { restoredView.current = true; setArchived(showingArchive); setFilter(restoredFilter); }
      const wantedState = showingArchive ? "archived" : "active";
      const chosen = pinned && (pinned.state ?? "active") === wantedState ? pinned : page.items[0];
      setOwner(value); setMoreProjects(page.more); setCurrentProject(chosen); setSelected(chosen?.id ?? "");
      setProjects(chosen && !page.items.some(item => item.id === chosen.id) ? [chosen, ...page.items] : page.items);
    }).catch(cause => { if (active) setError(friendlyError(cause)); });
    return () => { active = false; };
  }, [revision, projectLimit, selected, archived]);
  useEffect(() => {
    if (selected) { try { sessionStorage.setItem("tasktracker:view", JSON.stringify({ projectId: selected, filter, archived })); } catch { /* View preferences are optional. */ } }
  }, [selected, filter, archived]);
  function taskChanged(count: number, status: TaskStatus | "delete", destination?: string) {
    if (destination && destination !== selected) {
      void getProject(destination).then(project => setNotice({ scope: selected, text: `${count} ${count === 1 ? "task" : "tasks"} moved to ${project?.name ?? "project"}`, projectId: destination }));
    } else setNotice({ scope: selected, text: status === "delete" ? `${count} ${count === 1 ? "task" : "tasks"} deleted` : `${count} ${count === 1 ? "task" : "tasks"} saved in ${labels[status]}`, status: status === "delete" ? undefined : status });
  }
  if (!owner) return <main className={styles.shell}><a className="brand" href="/login"><span className="brand-mark" aria-hidden="true">✳</span> TaskTracker</a>
    <div className={`glass ${styles.empty}`} role="status">{error || "Loading…"}</div></main>;
  const project = currentProject;
  const total = project?.taskCount ?? 0; const done = project?.doneCount ?? 0; const percent = total ? Math.round(done / total * 100) : 0;
  const tasksReady = taskPage.ready;
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", weekday: "long" }).format(new Date());
  return <main className={styles.shell}>
    <header className={styles.header}><a className="brand" href="/projects"><span className="brand-mark" aria-hidden="true">✳</span> TaskTracker</a>
      <div className={styles.headerRight}>
        <a className={styles.profile} href="/login" aria-label="Workspace settings"><span className={styles.avatar}>{owner.name.slice(0, 1).toUpperCase()}</span><span>{owner.name}</span></a>
      </div></header>
    <div className={styles.heading}><h1>Projects</h1><span className={styles.date}>{date}</span></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className={styles.layout}>
      <aside className={`glass ${styles.sidebar}`} aria-label="Projects"><div className={styles.sectionLabel}><h2>{archived ? "Archived" : "My projects"}</h2><span>{projects.length}{moreProjects ? "+" : ""}</span></div>
        <button type="button" className={styles.textAction} onClick={() => { setArchived(value => !value); setSelected(""); setCurrentProject(undefined); setResumed(undefined); setProjectLimit(50); }}>{archived ? "Active projects" : "Archived projects"}</button>
        <div className={styles.projectList}>{projects.map(value => <button key={value.id} className={styles.project} aria-pressed={selected === value.id} onClick={() => { setResumed(undefined); setNotice(undefined); setSelected(value.id); setSearch(""); setDueFilter("all"); setFilter("all"); }}>
          <span className={styles.dot} data-color={value.color} aria-hidden="true" /><span className={styles.projectName}>{value.name}</span><span className={styles.projectCount}>{value.taskCount}</span>
        </button>)}</div>
        {moreProjects && <button className={`secondary ${styles.loadMore}`} onClick={() => setProjectLimit(value => value + 50)}>More projects</button>}
        <ProjectComposer onAdded={value => { setArchived(false); setResumed(undefined); setSelected(value.id); setFilter("all"); setSearch(""); setDueFilter("all"); }} />
        <WorkspaceBackupControls />
      </aside>
      <section className={`glass ${styles.board}`} aria-labelledby="board-title">
        <div className={styles.boardHeading}><h2 id="board-title" tabIndex={-1}>{project?.name ?? "Tasks"}</h2>{project && <span className={styles.countBadge}>{total}</span>}</div>
        {project ? <>
          <ProjectSettings key={`${project.id}:${resumed?.kind === "rename" ? resumed.id : ""}`} resumeDraft={resumed?.kind === "rename" ? resumed : undefined} project={project} onStateChanged={state => { setResumed(undefined); setCurrentProject({ ...project, state }); setArchived(state === "archived"); }} />
          {project.state === "archived" && <p className={styles.draftStatus}>Archived · restore to make changes</p>}
          <div className={styles.tabs} aria-label="Filter tasks">{(["all", "Todo", "InProgress", "Done"] as const).map(status => <button key={status} aria-pressed={filter === status} onClick={() => { setResumed(undefined); setNotice(undefined); setFilter(status); setSearch(""); setDueFilter("all"); }}>{status === "all" ? "All" : labels[status]}</button>)}</div>
          <div className={styles.searchRow}><label className={styles.searchField}>Search tasks<input type="search" aria-label="Search tasks" maxLength={200} placeholder="Search tasks" value={search} onChange={event => setSearch(event.target.value)} /></label>
            <select className={styles.statusSelect} aria-label="Due date filter" value={dueFilter} onChange={event => setDueFilter(event.target.value as DueFilter)}><option value="all">All dates</option><option value="today">Due today</option><option value="overdue">Overdue</option><option value="upcoming">Upcoming</option><option value="undated">No date</option></select>
          </div>
          {taskPage.error && <p className="form-error" role="alert">{taskPage.error}<button className={styles.textAction} onClick={taskPage.retry}>Retry tasks</button></p>}
          {notice?.scope === selected && <div className={styles.actionNotice} role="status"><span>{notice.text}</span>{notice.projectId && <button className={styles.textAction} onClick={() => { setArchived(false); setSelected(notice.projectId!); setFilter("all"); setResumed(undefined); }}>View project</button>}{notice.status && filter !== "all" && filter !== notice.status && <button className={styles.textAction} onClick={() => { setFilter(notice.status!); setSearch(""); setDueFilter("all"); }}>View {labels[notice.status]}</button>}<button className={styles.textAction} aria-label="Dismiss task notice" onClick={() => setNotice(undefined)}>×</button></div>}
          {!tasksReady && <p role="status" className={styles.draftStatus}>Loading tasks…</p>}
          <TaskList key={`${selected}:${filter}:${resumed?.kind === "editor" ? resumed.id : ""}`} resumeDraft={resumed?.kind === "editor" ? resumed : undefined} readOnly={project.state === "archived"} emptyLabel={search || dueFilter !== "all" ? taskPage.more ? "No matches yet" : "No matching tasks" : filter === "all" ? "No tasks yet" : `No ${labels[filter].toLowerCase()} tasks`} tasks={taskPage.ready ? taskPage.items : taskPage.items.filter(task => task.projectId === selected && (filter === "all" || task.status === filter))} onChanged={taskChanged} />
          {tasksReady && taskPage.more && <button className={`secondary ${styles.loadMore}`} disabled={taskPage.loadingMore} onClick={() => void taskPage.moreTasks()}>More tasks</button>}
          {project.state !== "archived" && <SavedDrafts key={selected} projectId={selected} onResume={value => { setResumed(value); if (value.kind === "editor") { setFilter("all"); setSearch(""); setDueFilter("all"); } }} />}
          {project.state !== "archived" && <TaskComposer key={`${selected}:${resumed?.kind === "composer" ? resumed.id : ""}`} draftId={resumed?.kind === "composer" ? resumed.id : undefined} projectId={selected} onAdded={(count, status) => { setFilter("all"); setSearch(""); setDueFilter("all"); taskChanged(count, status); }} />}
        </> : <div className={styles.empty}><span className={styles.emptyIcon} aria-hidden="true">✳</span><strong>{archived ? "No archived projects" : "Create a project"}</strong></div>}
      </section>
      <aside className={styles.right}><section className={`glass ${styles.summary}`} aria-labelledby="progress-title"><h2 id="progress-title">Progress</h2>
        <div className={styles.ring} style={{ background: `conic-gradient(#b68ad4 ${percent}%, #e9dcf27a 0)` }}><strong>{percent}%</strong></div><p className={styles.progressText} aria-label={`${done} of ${total} tasks completed`}>{done} / {total}</p>
      </section></aside>
    </div>
  </main>;
}
