"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { TaskStatus } from "./contracts";
import { createTasks } from "./store";
import { blankDraftData } from "./draft-contracts";
import type { DraftContent, DraftReceipt } from "./draft-contracts";
import { useDraft, DraftFeedback } from "./use-draft";
import { StatusSelect } from "./status-select";
import styles from "./local.module.css";

export function TaskComposer({ projectId, draftId, onAdded }: { projectId: string; draftId?: string; onAdded: (count: number, status: TaskStatus) => void }) {
  const initial: DraftContent = { projectId, kind: "composer", data: blankDraftData() };
  const draft = useDraft(`composer:${projectId}`, initial, draftId);
  const { data } = draft.content;
  const multiple = data.mode === "multiple"; const mode = data.mode;
  const title = data[mode]; const { dueDate, status } = data;
  function setTitle(value: string) { draft.controller?.patch({ [mode]: value }); }
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const submitting = useRef(false);
  const titles = multiple ? title.split(/\r?\n/).map(value => value.trim()).filter(Boolean) : [title];
  async function save(event: FormEvent) {
    event.preventDefault(); if (submitting.current) return;
    submitting.current = true; setSaving(true); setError("");
    try {
      const receipt = await draft.controller!.flush();
      const next: DraftContent = { projectId, kind: "composer", data: { ...data, [mode]: "", dueDate: "" } };
      const completion: DraftReceipt | undefined = receipt ? { ...receipt, remainder: next.data.single || next.data.multiple ? next : undefined } : undefined;
      await createTasks(projectId, titles, dueDate, status, completion);
      draft.controller!.accept(next, completion); onAdded(titles.length, status);
    }
    catch (cause) { if (cause instanceof Error && cause.message.startsWith("Draft changed")) draft.controller?.failed(cause); setError(cause instanceof Error ? cause.message : "Could not add tasks."); }
    finally { submitting.current = false; setSaving(false); }
  }
  return <form className={styles.taskForm} aria-label="Add tasks" onSubmit={event => void save(event)}>
    <div className={styles.composerHeading}><label htmlFor="task-title">{multiple ? "Tasks · one per line" : "Task"}</label>
      <button type="button" className={styles.textAction} aria-pressed={multiple} disabled={saving || !draft.ready} onClick={() => draft.controller?.patch({ mode: multiple ? "single" : "multiple" })}>{multiple ? "Single task" : "Add multiple"}</button></div>
    {multiple ? <textarea id="task-title" rows={4} placeholder="One task per line" maxLength={20100} value={title} onChange={event => setTitle(event.target.value)} required disabled={saving || !draft.ready} />
      : <input id="task-title" placeholder="What needs doing?" maxLength={200} value={title} onChange={event => setTitle(event.target.value)} required disabled={saving || !draft.ready} />}
    <div className={styles.composerFields}>
      <div><label htmlFor="new-task-status">Status</label><StatusSelect id="new-task-status" label="New task status" value={status} onChange={value => draft.controller?.patch({ status: value })} disabled={saving || !draft.ready} /></div>
      <div><label htmlFor="task-due">Due date</label><input id="task-due" type="date" value={dueDate} onChange={event => draft.controller?.patch({ dueDate: event.target.value })} disabled={saving || !draft.ready} /></div>
    </div>
    <DraftFeedback draft={draft} />
    {draft.version > 0 && <button type="button" className={styles.textAction} disabled={saving} onClick={() => { void draft.controller?.discard(initial).catch(cause => setError(cause instanceof Error ? cause.message : "Could not discard draft.")); }}>Discard draft</button>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className={`primary ${styles.addButton}`} disabled={saving || !draft.ready} type="submit" aria-label={multiple ? "Add multiple tasks" : "Add task"}>{saving ? "Adding…" : multiple ? `Add ${titles.length} tasks` : "＋ Add"}</button>
  </form>;
}
