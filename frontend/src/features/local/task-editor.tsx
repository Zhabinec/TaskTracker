"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Task, TaskStatus } from "./contracts";
import { createTasks, editTask } from "./store";
import { blankDraftData } from "./draft-contracts";
import type { DraftContent } from "./draft-contracts";
import { DraftFeedback, useDraft } from "./use-draft";
import { StatusSelect } from "./status-select";
import styles from "./local.module.css";

export function TaskEditor({ task, draftId, onClose, onSaved }: { task: Task; draftId?: string; onClose: () => void; onSaved: (status: TaskStatus) => void }) {
  const initial: DraftContent = { projectId: task.projectId, kind: "editor", task, data: { ...blankDraftData(), single: task.title, dueDate: task.dueDate ?? "", status: task.status } };
  const draft = useDraft(`editor:${task.id}`, initial, draftId);
  const { single: title, dueDate, status } = draft.content.data;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (draft.ready) input.current?.focus(); }, [draft.ready]);

  async function save(event?: FormEvent, asNew = false) {
    event?.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setSaving(true); setError("");
    try {
      const receipt = await draft.controller!.flush();
      if (asNew) await createTasks(task.projectId, [title], dueDate, status, receipt);
      else await editTask(draft.content.task!, title, dueDate, status, receipt);
      draft.controller!.accept(initial); onSaved(status); onClose();
    }
    catch (cause) { if (cause instanceof Error && cause.message.startsWith("Draft changed")) draft.controller?.failed(cause); setError(cause instanceof Error ? cause.message : "Could not save this task."); }
    finally { submitting.current = false; setSaving(false); }
  }

  async function cancel() {
    if (submitting.current) return;
    try { await draft.controller?.discard(initial); onClose(); }
    catch (cause) { if (cause instanceof Error && cause.message.startsWith("Draft changed")) draft.controller?.failed(cause); setError(cause instanceof Error ? cause.message : "Could not discard draft."); }
  }
  return <form className={`${styles.taskForm} ${styles.editor}`} aria-label="Edit task" onSubmit={event => void save(event)} onKeyDown={event => {
    if (event.key === "Escape" && !submitting.current) { event.preventDefault(); event.stopPropagation(); void cancel(); }
  }}>
    <label htmlFor={`edit-title-${task.id}`}>Task</label>
    <input ref={input} id={`edit-title-${task.id}`} required maxLength={200} value={title} onChange={event => draft.controller?.patch({ single: event.target.value })} disabled={saving || !draft.ready} aria-invalid={Boolean(error)} aria-describedby={error ? `edit-error-${task.id}` : undefined} />
    <label htmlFor={`edit-due-${task.id}`}>Due date</label>
    <input id={`edit-due-${task.id}`} type="date" value={dueDate} onChange={event => draft.controller?.patch({ dueDate: event.target.value })} disabled={saving || !draft.ready} />
    <label htmlFor={`edit-status-${task.id}`}>Status</label>
    <StatusSelect id={`edit-status-${task.id}`} label="Task status" value={status} onChange={value => draft.controller?.patch({ status: value })} disabled={saving || !draft.ready} />
    <DraftFeedback draft={draft} />
    {error.includes("another tab") && <button type="button" className={styles.textAction} disabled={saving || !draft.ready} onClick={() => void save(undefined, true)}>Add as new task</button>}
    {error && <p id={`edit-error-${task.id}`} className="form-error" role="alert">{error}</p>}
    <div className={styles.editorActions}>
      <button className="secondary" type="button" onClick={() => void cancel()} disabled={saving || !draft.ready}>Cancel</button>
      <button className="primary" type="submit" disabled={saving || !draft.ready}>{saving ? "Saving…" : "Save"}</button>
    </div>
  </form>;
}
