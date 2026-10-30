"use client";

import { useRef, useState } from "react";
import type { Task, TaskStatus } from "./contracts";
import { changeTasks } from "./store";
import { StatusSelect } from "./status-select";
import { TaskEditor } from "./task-editor";
import styles from "./local.module.css";

export function TaskList({ tasks, onChanged }: { tasks: Task[]; onChanged: (count: number, status: TaskStatus | "delete") => void }) {
  const [editing, setEditing] = useState<Task>();
  const [selecting, setSelecting] = useState(false); const [selected, setSelected] = useState<Task[]>([]);
  const [target, setTarget] = useState<TaskStatus>("Done");
  const [deleting, setDeleting] = useState<Task[]>([]);
  const [working, setWorking] = useState(false); const [error, setError] = useState("");
  const busy = useRef(false);
  const deleteOrigin = useRef<string>("");
  function focus(id: string) { requestAnimationFrame(() => (document.getElementById(id) ?? document.getElementById("board-title"))?.focus()); }
  function closeEditor() { const id = editing?.id; setEditing(undefined); focus(`edit-task-${id}`); }
  async function change(items: Task[], status: TaskStatus | "delete") {
    if (busy.current) return;
    busy.current = true; setWorking(true); setError("");
    try {
      await changeTasks(items, status); setSelected([]); setDeleting([]); onChanged(items.length, status);
      focus(status === "delete" ? "board-title" : `status-${items[0].id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update tasks."); }
    finally { busy.current = false; setWorking(false); }
  }
  return <>
    <div className={styles.selectionBar}>
      <button type="button" className={styles.textAction} disabled={working || Boolean(editing)} aria-pressed={selecting} onClick={() => { setSelecting(value => !value); setSelected([]); setDeleting([]); setError(""); }}>{selecting ? "Cancel selection" : "Select tasks"}</button>
      {selecting && <button className={styles.textAction} disabled={working} onClick={() => { setSelected(tasks.slice(0, 100)); setDeleting([]); }}>Select loaded ({Math.min(tasks.length, 100)})</button>}
    </div>
    {selecting && <div className={styles.bulkBar} aria-label="Selected tasks">
      <span>{selected.length} selected</span>
      <StatusSelect label="Selected tasks status" value={target} onChange={setTarget} disabled={working} />
      <button className="secondary" disabled={working || !selected.length} onClick={() => void change(selected, target)}>Apply</button>
      <button id="delete-selected" className={styles.textAction} disabled={working || !selected.length} onClick={() => { deleteOrigin.current = "delete-selected"; setDeleting(selected); }}>Delete selected</button>
    </div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {deleting.length > 0 && <section className={styles.confirmDelete} aria-label="Confirm deletion" onKeyDown={event => { if (event.key === "Escape" && !busy.current) { setDeleting([]); focus(deleteOrigin.current); } }}>
      <p>Delete {deleting.length === 1 ? `“${deleting[0].title}”` : `${deleting.length} tasks`}? This cannot be undone.</p>
      <div className={styles.editorActions}><button className="secondary" autoFocus disabled={working} onClick={() => { setDeleting([]); focus(deleteOrigin.current); }}>Cancel</button>
        <button className="primary" disabled={working} onClick={() => void change(deleting, "delete")}>Delete permanently</button></div>
    </section>}
    <ul className={styles.taskList}>{tasks.map(task => <li key={task.id} className={styles.task}>
      {selecting && <label className={styles.selectionTarget}><input type="checkbox" aria-label={`Select task: ${task.title}`} checked={selected.some(value => value.id === task.id)} disabled={working || (selected.length >= 100 && !selected.some(value => value.id === task.id))} onChange={event => { setDeleting([]); setSelected(current => event.target.checked ? [...current, task] : current.filter(value => value.id !== task.id)); }} /></label>}
      <div className={styles.taskContent}>{editing?.id === task.id ? <TaskEditor task={editing} onClose={closeEditor} onSaved={status => onChanged(1, status)} /> : <>
        <button className={`${styles.taskTitle} ${styles.editTask} ${task.status === "Done" ? styles.done : ""}`} id={`edit-task-${task.id}`} aria-label={`Edit task: ${task.title}`} disabled={working || selecting || Boolean(editing)} onClick={() => { setEditing(task); setDeleting([]); }}>{task.title}</button>
        <div className={styles.taskMeta}>
          <StatusSelect id={`status-${task.id}`} label={`Status: ${task.title}`} value={task.status} disabled={working || selecting || Boolean(editing)} onChange={status => void change([task], status)} />
          {task.dueDate && <time dateTime={task.dueDate}>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${task.dueDate}T12:00:00`))}</time>}
        </div>
      </>}</div>
      {!selecting && <button id={`delete-task-${task.id}`} className={styles.delete} disabled={working || Boolean(editing)} aria-label={`Delete task: ${task.title}`} onClick={() => { deleteOrigin.current = `delete-task-${task.id}`; setDeleting([task]); }}>×</button>}
    </li>)}</ul>
  </>;
}
