"use client";
import { useEffect, useRef, useState } from "react";
import { flushDrafts } from "@/features/local/draft-controller";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";
import { prepareOfflineShell } from "@/shared/pwa/offline-shell";

export function OfflineRuntime() {
  const [attempt, setAttempt] = useState(0);
  const [updating, setUpdating] = useState(false); const [updateError, setUpdateError] = useState("");
  const [waiting, setWaiting] = useState<ServiceWorkerRegistration>();
  const [status, setStatus] = useState(""); const reload = useRef(false);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext || process.env.NODE_ENV !== "production") return;
    const lifetime = new AbortController();
    const change = () => { if (reload.current) window.location.reload(); else setWaiting(undefined); };
    navigator.serviceWorker.addEventListener("controllerchange", change);
    void Promise.resolve().then(() => {
      if (lifetime.signal.aborted) return;
      setStatus("Preparing offline…");
      return prepareOfflineShell(lifetime.signal, setWaiting).then(() => {
        if (!lifetime.signal.aborted) { setStatus("Offline ready"); window.dispatchEvent(new Event("tasktracker:offline-ready")); }
      });
    }).catch(() => { if (!lifetime.signal.aborted) setStatus("Offline setup unavailable"); });
    return () => { lifetime.abort(); navigator.serviceWorker.removeEventListener("controllerchange", change); };
  }, [attempt]);
  if (waiting?.waiting) return <div className="glass runtime-notice" role="status"><Icon name="restore" /><span className="sr-only">Update available</span><button className="secondary" disabled={updating} onClick={() => { setUpdating(true); setUpdateError(""); void flushDrafts().then(() => { reload.current = true; waiting.waiting?.postMessage("SKIP_WAITING"); }).catch(() => { setUpdateError("Save your draft before updating."); setUpdating(false); }); }}>{updating ? "Saving…" : "Update"}</button>{updateError && <span role="alert">{updateError}</span>}</div>;
  return status ? <div className="glass runtime-notice" data-state={status === "Offline ready" ? "ready" : "pending"} role="status" title={status}>
    <Icon name={status === "Offline ready" ? "ready" : "loader"} className={status === "Preparing offline…" ? "is-spinning" : ""} /><span className={status === "Offline ready" ? "sr-only" : undefined}>{status}</span>
    {status === "Offline setup unavailable" && <button className="secondary" onClick={() => setAttempt(value => value + 1)}>Retry offline setup</button>}<IconButton icon="close" label="Dismiss" onClick={() => setStatus("")} /></div> : null;
}
