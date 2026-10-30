"use client";
import { useEffect, useRef, useState } from "react";
import type { LocalProfile, Project, Task, TaskStatus } from "./contracts";
import { listProjects, listTasks, profile, subscribeChanges } from "./store";
import styles from "./local.module.css";
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
  const [selected, setSelected] = useState(""); const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [projectLimit, setProjectLimit] = useState(50); const [taskLimit, setTaskLimit] = useState(50);
  const [moreProjects, setMoreProjects] = useState(false); const [revision, setRevision] = useState(0);
  const [taskPage, setTaskPage] = useState<{ key: string; items: Task[]; more: boolean }>({ key: "", items: [], more: false });
  const [error, setError] = useState("");
  const [resumed, setResumed] = useState<Draft>();
  const restoredView = useRef(false);
  const [notice, setNotice] = useState<{ text: string; status?: TaskStatus }>();
  const key = `${selected}:${filter}:${taskLimit}`;
  useEffect(() => subscribeChanges(() => setRevision(value => value + 1)), []);
  useEffect(() => {
    let active = true;
    Promise.all([profile(), listProjects(projectLimit)]).then(([value, page]) => {
      if (!active) return;
      if (!value) { window.location.replace("/login"); return; }
      setOwner(value); setProjects(page.items); setMoreProjects(page.more);
      let previous = "";
      if (!restoredView.current) {
        restoredView.current = true;
        try { const view = JSON.parse(sessionStorage.getItem("tasktracker:view") ?? "null"); if (view && page.items.some(item => item.id === view.projectId)) { previous = view.projectId; if (["all", "Todo", "InProgress", "Done"].includes(view.filter)) setFilter(view.filter); } } catch { /* Fall back to the first project. */ }
      }
      setSelected(current => page.items.some(item => item.id === current) ? current : previous || page.items[0]?.id || "");
    }).catch(cause => { if (active) setError(friendlyError(cause)); });
    return () => { active = false; };
  }, [revision, projectLimit]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    listTasks(selected, filter, taskLimit).then(page => { if (active) setTaskPage({ key, ...page }); })
      .catch(cause => { if (active) setError(friendlyError(cause)); });
    return () => { active = false; };
  }, [selected, filter, taskLimit, key, revision]);
  useEffect(() => {
    if (selected) { try { sessionStorage.setItem("tasktracker:view", JSON.stringify({ projectId: selected, filter })); } catch { /* View preferences are optional. */ } }
  }, [selected, filter]);
  function taskChanged(count: number, status: TaskStatus | "delete") {
    setNotice({ text: status === "delete" ? `${count} ${count === 1 ? "task" : "tasks"} deleted` : `${count} ${count === 1 ? "task" : "tasks"} saved in ${labels[status]}`, status: status === "delete" ? undefined : status });
  }
  if (!owner) return <main className={styles.shell}><a className="brand" href="/login"><span className="brand-mark" aria-hidden="true">✳</span> TaskTracker</a>
    <div className={`glass ${styles.empty}`} role="status">{error || "Loading…"}</div></main>;
  const project = projects.find(value => value.id === selected);
  const total = project?.taskCount ?? 0; const done = project?.doneCount ?? 0; const percent = total ? Math.round(done / total * 100) : 0;
  const tasksReady = taskPage.key === key;
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", weekday: "long" }).format(new Date());
  return <main className={styles.shell}>
    <header className={styles.header}><a className="brand" href="/projects"><span className="brand-mark" aria-hidden="true">✳</span> TaskTracker</a>
      <div className={styles.headerRight}>
        <a className={styles.profile} href="/login" aria-label="Workspace settings"><span className={styles.avatar}>{owner.name.slice(0, 1).toUpperCase()}</span><span>{owner.name}</span></a>
      </div></header>
    <div className={styles.heading}><h1>Projects</h1><span className={styles.date}>{date}</span></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className={styles.layout}>
      <aside className={`glass ${styles.sidebar}`} aria-label="Projects"><div className={styles.sectionLabel}><h2>My projects</h2><span>{projects.length}{moreProjects ? "+" : ""}</span></div>
        <div className={styles.projectList}>{projects.map(value => <button key={value.id} className={styles.project} aria-pressed={selected === value.id} onClick={() => { setResumed(undefined); setNotice(undefined); setSelected(value.id); setTaskLimit(50); setFilter("all"); }}>
          <span className={styles.dot} data-color={value.color} aria-hidden="true" /><span className={styles.projectName}>{value.name}</span><span className={styles.projectCount}>{value.taskCount}</span>
        </button>)}</div>
        {moreProjects && <button className={`secondary ${styles.loadMore}`} onClick={() => setProjectLimit(value => value + 50)}>More projects</button>}
        <ProjectComposer onAdded={value => { setResumed(undefined); setSelected(value.id); setFilter("all"); setTaskLimit(50); }} />
        <WorkspaceBackupControls />
      </aside>
      <section className={`glass ${styles.board}`} aria-labelledby="board-title">
        <div className={styles.boardHeading}><h2 id="board-title" tabIndex={-1}>{project?.name ?? "Tasks"}</h2>{project && <span className={styles.countBadge}>{total}</span>}</div>
        {project ? <>
          <div className={styles.tabs} aria-label="Filter tasks">{(["all", "Todo", "InProgress", "Done"] as const).map(status => <button key={status} aria-pressed={filter === status} onClick={() => { setResumed(undefined); setNotice(undefined); setFilter(status); setTaskLimit(50); }}>{status === "all" ? "All" : labels[status]}</button>)}</div>
          {notice && <div className={styles.actionNotice} role="status"><span>{notice.text}</span>{notice.status && filter !== "all" && filter !== notice.status && <button className={styles.textAction} onClick={() => { setFilter(notice.status!); setTaskLimit(50); }}>View {labels[notice.status]}</button>}<button className={styles.textAction} aria-label="Dismiss task notice" onClick={() => setNotice(undefined)}>×</button></div>}
          {!tasksReady ? <p role="status" className={styles.empty}>Loading tasks…</p> : <TaskList key={`${selected}:${filter}:${resumed?.kind === "editor" ? resumed.id : ""}`} resumeDraft={resumed?.kind === "editor" ? resumed : undefined} emptyLabel={filter === "all" ? "No tasks yet" : `No ${labels[filter].toLowerCase()} tasks`} tasks={taskPage.items} onChanged={taskChanged} />}
          {tasksReady && taskPage.more && <button className={`secondary ${styles.loadMore}`} onClick={() => setTaskLimit(value => value + 50)}>More tasks</button>}
          <SavedDrafts key={selected} projectId={selected} onResume={value => { setResumed(value); if (value.kind === "editor") { setFilter("all"); setTaskLimit(50); } }} />
          <TaskComposer key={`${selected}:${resumed?.kind === "composer" ? resumed.id : ""}`} draftId={resumed?.kind === "composer" ? resumed.id : undefined} projectId={selected} onAdded={(count, status) => { setFilter("all"); setTaskLimit(50); taskChanged(count, status); }} />
        </> : <div className={styles.empty}><span className={styles.emptyIcon} aria-hidden="true">✳</span><strong>Create a project</strong></div>}
      </section>
      <aside className={styles.right}><section className={`glass ${styles.summary}`} aria-labelledby="progress-title"><h2 id="progress-title">Progress</h2>
        <div className={styles.ring} style={{ background: `conic-gradient(#b68ad4 ${percent}%, #e9dcf27a 0)` }}><strong>{percent}%</strong></div><p className={styles.progressText} aria-label={`${done} of ${total} tasks completed`}>{done} / {total}</p>
      </section></aside>
    </div>
  </main>;
}
