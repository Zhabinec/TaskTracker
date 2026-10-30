"use client";

import { useRef, useState } from "react";
import { backupLimit, parseBackup } from "./backup";
import { exportWorkspace, importWorkspace } from "./store";
import styles from "./local.module.css";

export function WorkspaceBackupControls() {
  const [preview, setPreview] = useState<{ source: string; projects: number; tasks: number }>();
  const [working, setWorking] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const busy = useRef(false); const file = useRef<HTMLInputElement>(null);
  async function run(action: () => Promise<void>) {
    if (busy.current) return; busy.current = true; setWorking(true); setError(""); setMessage("");
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Backup operation failed."); }
    finally { busy.current = false; setWorking(false); }
  }
  return <details className={styles.backups}><summary>Backups</summary>
    <div className={styles.backupActions}>
      <button className="secondary" disabled={working} onClick={() => void run(async () => {
        const source = await exportWorkspace(); const url = URL.createObjectURL(new Blob([source], { type: "application/json" }));
        const link = document.createElement("a"); link.href = url; link.download = `tasktracker-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
        setMessage("Backup download started.");
      })}>Export backup</button>
      <label htmlFor="backup-file">Import backup</label><input ref={file} id="backup-file" type="file" accept=".json,application/json" disabled={working} onChange={event => {
        const selected = event.target.files?.[0]; setPreview(undefined);
        if (!selected) return;
        void run(async () => {
          if (selected.size > backupLimit) throw new Error("Backup exceeds 5 MB.");
          const source = await selected.text(); const data = parseBackup(source);
          setPreview({ source, projects: data.projects.length, tasks: data.tasks.length });
        });
        event.target.value = "";
      }} />
      {preview && <><p>{preview.projects} {preview.projects === 1 ? "project" : "projects"} · {preview.tasks} {preview.tasks === 1 ? "task" : "tasks"}. Imports as new copies.</p>
        <button className="primary" disabled={working || !preview.projects} onClick={() => void run(async () => {
          await importWorkspace(preview.source); setPreview(undefined); setMessage("Backup imported. Existing projects kept."); file.current?.focus();
        })}>Import copies</button>
        <button className="secondary" disabled={working} onClick={() => setPreview(undefined)}>Cancel import</button></>}
      {working && <p role="status">Working…</p>}{message && <p role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </details>;
}
