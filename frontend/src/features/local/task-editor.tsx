"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Task, TaskStatus } from "./contracts";
import { editTask } from "./store";
import { StatusSelect } from "./status-select";
import styles from "./local.module.css";

export function TaskEditor({ task, onClose, onSaved }: { task: Task; onClose: () => void; onSaved: (status: TaskStatus) => void }) {
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setSaving(true); setError("");
    try { await editTask(task, title, dueDate, status); onSaved(status); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this task."); }
    finally { submitting.current = false; setSaving(false); }
  }

  return <form className={`${styles.taskForm} ${styles.editor}`} aria-label="Edit task" onSubmit={event => void save(event)} onKeyDown={event => {
    if (event.key === "Escape" && !submitting.current) { event.preventDefault(); event.stopPropagation(); onClose(); }
  }}>
    <label htmlFor={`edit-title-${task.id}`}>Task</label>
    <input id={`edit-title-${task.id}`} autoFocus required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} disabled={saving} aria-invalid={Boolean(error)} aria-describedby={error ? `edit-error-${task.id}` : undefined} />
    <label htmlFor={`edit-due-${task.id}`}>Due date</label>
    <input id={`edit-due-${task.id}`} type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} disabled={saving} />
    <label htmlFor={`edit-status-${task.id}`}>Status</label>
    <StatusSelect id={`edit-status-${task.id}`} label="Task status" value={status} onChange={setStatus} disabled={saving} />
    {error && <p id={`edit-error-${task.id}`} className="form-error" role="alert">{error}</p>}
    <div className={styles.editorActions}>
      <button className="secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button>
      <button className="primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
    </div>
  </form>;
}
