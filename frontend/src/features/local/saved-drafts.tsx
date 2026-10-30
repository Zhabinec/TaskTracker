"use client";

import { useEffect, useState } from "react";
import type { Draft } from "./draft-contracts";
import { listDrafts, subscribeDraftChanges } from "./store";
import { discardSavedDraft } from "./draft-controller";
import styles from "./local.module.css";

export function SavedDrafts({ projectId, label = "Saved drafts", onResume }: { projectId: string; label?: string; onResume: (draft: Draft) => void }) {
  const [revision, setRevision] = useState(0); const [limit, setLimit] = useState(100);
  const [page, setPage] = useState<{ items: Draft[]; more: boolean }>({ items: [], more: false });
  const [error, setError] = useState(""); const [working, setWorking] = useState(false);
  useEffect(() => subscribeDraftChanges(() => setRevision(value => value + 1)), []);
  useEffect(() => {
    let active = true;
    listDrafts(projectId, limit).then(value => { if (active) { setPage(value); setError(""); } }).catch(() => { if (active) setError("Saved drafts unavailable."); });
    return () => { active = false; };
  }, [projectId, revision, limit]);
  if (!page.items.length && !error) return null;
  return <details className={styles.savedDrafts}><summary>{label} ({page.items.length}{page.more ? "+" : ""})</summary>
    {error && <p className="form-error" role="alert">{error}</p>}
    <ul>{page.items.map(draft => <li key={draft.id}>
      <span>{draft.kind === "editor" ? "Edit" : draft.kind === "project" ? "Project" : "New tasks"} · {(draft.data[draft.data.mode] || draft.data.single || draft.data.multiple).slice(0, 70) || "Untitled"}</span>
      <div><button className={styles.textAction} disabled={working} onClick={() => onResume(draft)}>Resume</button>
        <button className={styles.textAction} disabled={working} onClick={() => {
          setWorking(true); setError("");
          void discardSavedDraft(draft).catch(cause => setError(cause instanceof Error ? cause.message : "Could not discard draft.")).finally(() => setWorking(false));
        }}>Discard</button></div>
    </li>)}</ul>
    {page.more && <button className={styles.textAction} onClick={() => setLimit(value => value + 100)}>More drafts</button>}
  </details>;
}
