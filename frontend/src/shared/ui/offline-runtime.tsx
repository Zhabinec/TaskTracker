"use client";
import { useEffect, useRef, useState } from "react";
import { flushDrafts } from "@/features/local/draft-controller";

export function OfflineRuntime() {
  const [attempt, setAttempt] = useState(0);
  const [updating, setUpdating] = useState(false); const [updateError, setUpdateError] = useState("");
  const [waiting, setWaiting] = useState<ServiceWorkerRegistration>();
  const [status, setStatus] = useState(""); const reload = useRef(false);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext || process.env.NODE_ENV !== "production") return;
    let active = true;
    const change = () => { if (reload.current) window.location.reload(); };
    navigator.serviceWorker.addEventListener("controllerchange", change);
    void (async () => {
      let build = "local-v1";
      try { const response = await fetch("/build-info.json", { cache: "no-store" }); if (response.ok) build = (await response.json()).build; }
      catch { if (navigator.serviceWorker.controller) { if (active) setStatus("Offline ready"); return; } }
      if (active) setStatus("Preparing offline…");
      const registration = await navigator.serviceWorker.register(`/sw.js?build=${encodeURIComponent(build)}`, { scope: "/", updateViaCache: "none" });
      if (registration.waiting && active) setWaiting(registration);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && active) {
            if (navigator.serviceWorker.controller) setWaiting(registration);
          }
        });
      });
      let deadline: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error("Offline preparation timed out.")), 25000); })]);
      } finally { clearTimeout(deadline); }
      if (!navigator.serviceWorker.controller) await new Promise<void>((resolve, reject) => {
        const controlled = () => { if (navigator.serviceWorker.controller) { cleanup(); resolve(); } };
        const timeout = setTimeout(() => { cleanup(); reject(new Error("Offline shell did not take control.")); }, 15000);
        function cleanup() { clearTimeout(timeout); navigator.serviceWorker.removeEventListener("controllerchange", controlled); }
        navigator.serviceWorker.addEventListener("controllerchange", controlled);
        registration.active?.postMessage("CLAIM_CLIENTS"); controlled();
      });
      if (active) { setStatus("Offline ready"); window.dispatchEvent(new Event("tasktracker:offline-ready")); }
    })().catch(() => { if (active) setStatus("Offline setup unavailable"); });
    return () => { active = false; navigator.serviceWorker.removeEventListener("controllerchange", change); };
  }, [attempt]);
  if (waiting) return <div className="glass runtime-notice" role="status">Update available<button className="secondary" disabled={updating} onClick={() => { setUpdating(true); setUpdateError(""); void flushDrafts().then(() => { reload.current = true; waiting.waiting?.postMessage("SKIP_WAITING"); }).catch(() => { setUpdateError("Save your draft before updating."); setUpdating(false); }); }}>{updating ? "Saving…" : "Update"}</button>{updateError && <span role="alert">{updateError}</span>}</div>;
  return status ? <div className="glass runtime-notice" role="status"><span aria-hidden="true">◈</span>{status}{status === "Offline setup unavailable" && <button className="secondary" onClick={() => setAttempt(value => value + 1)}>Retry offline setup</button>}<button className="secondary" aria-label="Dismiss" onClick={() => setStatus("")}>×</button></div> : null;
}
