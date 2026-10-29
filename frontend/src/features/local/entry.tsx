"use client";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { profile, saveProfile } from "./store";
import styles from "./local.module.css";

export function LocalEntry() {
  const [name, setName] = useState(""); const [existing, setExisting] = useState(false);
  const [ready, setReady] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  useEffect(() => { let active = true; profile().then(value => { if (active) { setName(value?.name ?? ""); setExisting(Boolean(value)); setReady(true); } }).catch(() => { if (active) { setError("Storage unavailable. Allow site data and retry."); setReady(true); } }); return () => { active = false; }; }, []);
  async function open(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return; setPending(true); setError("");
    try { await saveProfile(name); window.location.assign("/projects"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save your workspace."); setPending(false); }
  }
  return <form onSubmit={open} className={styles.entryForm} aria-busy={pending || !ready}>
    <label htmlFor="display-name">Name</label>
    <input id="display-name" name="name" aria-label="Workspace name" placeholder="Your space" value={name} onChange={event => setName(event.target.value)} maxLength={60} autoComplete="off" disabled={pending || !ready} />
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="primary" disabled={pending || !ready} type="submit">{pending ? "Opening…" : !ready ? "Loading…" : existing ? "Continue ↗" : "Get started ↗"}</button>
    <details className={styles.finePrint}><summary>Stored in this browser</summary><p>Clearing site data removes your projects. Wait for offline setup before going offline.</p></details>
  </form>;
}
