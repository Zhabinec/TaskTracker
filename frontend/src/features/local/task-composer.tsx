"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { TaskStatus } from "./contracts";
import { createTasks } from "./store";
import { StatusSelect } from "./status-select";
import styles from "./local.module.css";

export function TaskComposer({ projectId, onAdded }: { projectId: string; onAdded: (count: number, status: TaskStatus) => void }) {
  const [multiple, setMultiple] = useState(false);
  const [drafts, setDrafts] = useState({ single: "", multiple: "" }); const [dueDate, setDueDate] = useState("");
  const mode = multiple ? "multiple" : "single";
  const title = drafts[mode];
  function setTitle(value: string) { setDrafts(current => ({ ...current, [mode]: value })); }
  const [status, setStatus] = useState<TaskStatus>("Todo");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const submitting = useRef(false);
  const titles = multiple ? title.split(/\r?\n/).map(value => value.trim()).filter(Boolean) : [title];
  async function save(event: FormEvent) {
    event.preventDefault(); if (submitting.current) return;
    submitting.current = true; setSaving(true); setError("");
    try { await createTasks(projectId, titles, dueDate, status); setTitle(""); setDueDate(""); onAdded(titles.length, status); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add tasks."); }
    finally { submitting.current = false; setSaving(false); }
  }
  return <form className={styles.taskForm} aria-label="Add tasks" onSubmit={event => void save(event)}>
    <div className={styles.composerHeading}><label htmlFor="task-title">{multiple ? "Tasks · one per line" : "Task"}</label>
      <button type="button" className={styles.textAction} aria-pressed={multiple} disabled={saving} onClick={() => setMultiple(value => !value)}>{multiple ? "Single task" : "Add multiple"}</button></div>
    {multiple ? <textarea id="task-title" rows={4} placeholder="One task per line" maxLength={20100} value={title} onChange={event => setTitle(event.target.value)} required disabled={saving} />
      : <input id="task-title" placeholder="What needs doing?" maxLength={200} value={title} onChange={event => setTitle(event.target.value)} required disabled={saving} />}
    <div className={styles.composerFields}>
      <div><label htmlFor="new-task-status">Status</label><StatusSelect id="new-task-status" label="New task status" value={status} onChange={setStatus} disabled={saving} /></div>
      <div><label htmlFor="task-due">Due date</label><input id="task-due" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} disabled={saving} /></div>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className={`primary ${styles.addButton}`} disabled={saving} type="submit" aria-label={multiple ? "Add multiple tasks" : "Add task"}>{saving ? "Adding…" : multiple ? `Add ${titles.length} tasks` : "＋ Add"}</button>
  </form>;
}
