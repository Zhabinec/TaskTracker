"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Project } from "./contracts";
import { blankDraftData } from "./draft-contracts";
import type { Draft, DraftContent } from "./draft-contracts";
import { useDraft, DraftFeedback } from "./use-draft";
import { updateProject } from "./store";
import styles from "./local.module.css";

export function ProjectSettings({ project, resumeDraft, onStateChanged }: { project: Project; resumeDraft?: Draft; onStateChanged: (state: "active" | "archived") => void }) {
  const [renaming, setRenaming] = useState(Boolean(resumeDraft)); const [working, setWorking] = useState(false);
  const [error, setError] = useState(""); const busy = useRef(false);
  async function changeState() {
    if (busy.current) return; busy.current = true; setWorking(true); setError("");
    const state = project.state === "archived" ? "active" : "archived";
    try { await updateProject(project, project.name, state); onStateChanged(state); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update project."); }
    finally { busy.current = false; setWorking(false); }
  }
  return <details className={styles.projectSettings} open={renaming || undefined}><summary>Project settings</summary>
    {renaming ? <RenameProject project={resumeDraft?.project ?? project} draftId={resumeDraft?.id} onClose={() => setRenaming(false)} onSaved={state => { setRenaming(false); onStateChanged(state); }} />
      : <button type="button" className={styles.textAction} disabled={working} onClick={() => setRenaming(true)}>Rename project</button>}
    <button type="button" className={styles.textAction} disabled={working || renaming} onClick={() => void changeState()}>{project.state === "archived" ? "Restore project" : "Archive project"}</button>
    {error && <p className="form-error" role="alert">{error}</p>}
  </details>;
}
function RenameProject({ project, draftId, onClose, onSaved }: { project: Project; draftId?: string; onClose: () => void; onSaved: (state: "active" | "archived") => void }) {
  const initial: DraftContent = { projectId: project.id, kind: "rename", project, data: { ...blankDraftData(), single: project.name } };
  const draft = useDraft(`rename:${project.id}`, initial, draftId);
  const [working, setWorking] = useState(false); const [error, setError] = useState(""); const busy = useRef(false);
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy.current) return; busy.current = true; setWorking(true); setError("");
    try {
      const receipt = await draft.controller!.flush(); const source = draft.content.project!;
      await updateProject(source, draft.content.data.single, source.state ?? "active", receipt);
      draft.controller!.accept(initial); onSaved(source.state ?? "active");
    } catch (cause) { if (cause instanceof Error && cause.message.startsWith("Draft changed")) draft.controller?.failed(cause); setError(cause instanceof Error ? cause.message : "Could not rename project."); }
    finally { busy.current = false; setWorking(false); }
  }
  return <form className={styles.taskForm} onSubmit={event => void save(event)}>
    <label htmlFor="rename-project">Project name</label><input id="rename-project" maxLength={100} required value={draft.content.data.single} disabled={working || !draft.ready} onChange={event => draft.controller?.patch({ single: event.target.value })} />
    <DraftFeedback draft={draft} />{error && <p className="form-error" role="alert">{error}</p>}
    <div className={styles.editorActions}><button className="secondary" type="button" disabled={working || !draft.ready} onClick={() => { void draft.controller?.discard(initial).then(onClose).catch(cause => setError(cause instanceof Error ? cause.message : "Could not discard rename.")); }}>Cancel rename</button><button className="primary" disabled={working || !draft.ready}>Save name</button></div>
  </form>;
}
