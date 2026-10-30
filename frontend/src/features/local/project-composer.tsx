"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Project } from "./contracts";
import { blankDraftData } from "./draft-contracts";
import type { DraftContent } from "./draft-contracts";
import { useDraft, DraftFeedback } from "./use-draft";
import { createProject } from "./store";
import { SavedDrafts } from "./saved-drafts";
import styles from "./local.module.css";

export function ProjectComposer({ onAdded }: { onAdded: (project: Project) => void }) {
  const [resumed, setResumed] = useState<string>();
  return <><ProjectForm key={resumed ?? "new"} draftId={resumed} onAdded={onAdded} />
    <SavedDrafts projectId="" label="Project drafts" onResume={draft => setResumed(draft.id)} /></>;
}
function ProjectForm({ onAdded, draftId }: { onAdded: (project: Project) => void; draftId?: string }) {
  const initial: DraftContent = { projectId: "", kind: "project", data: blankDraftData() };
  const draft = useDraft("project", initial, draftId);
  const [working, setWorking] = useState(false); const [error, setError] = useState(""); const busy = useRef(false);
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy.current) return; busy.current = true; setWorking(true); setError("");
    try { const receipt = await draft.controller!.flush(); const project = await createProject(draft.content.data.single, receipt); draft.controller!.accept(initial); onAdded(project); }
    catch (cause) { if (cause instanceof Error && cause.message.startsWith("Draft changed")) draft.controller?.failed(cause); setError(cause instanceof Error ? cause.message : "Could not create project."); }
    finally { busy.current = false; setWorking(false); }
  }
  return <><form className={styles.inlineForm} onSubmit={event => void save(event)}><label htmlFor="project-name">New project</label>
    <input id="project-name" placeholder="Name" maxLength={100} required value={draft.content.data.single} onChange={event => draft.controller?.patch({ single: event.target.value })} disabled={working || !draft.ready} />
    <button className="secondary" disabled={working || !draft.ready} type="submit" aria-label="Create project" title="Create project">＋</button>
  </form><DraftFeedback draft={draft} />{error && <p className="form-error" role="alert">{error}</p>}</>;
}
