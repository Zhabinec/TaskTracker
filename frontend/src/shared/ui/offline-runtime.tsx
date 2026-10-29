"use client";
import { useEffect, useRef, useState } from "react";

export function OfflineRuntime() {
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
      catch { if (navigator.serviceWorker.controller) { if (active) setStatus("Офлайн доступен"); return; } }
      const registration = await navigator.serviceWorker.register(`/sw.js?build=${encodeURIComponent(build)}`, { scope: "/", updateViaCache: "none" });
      if (registration.waiting && active) setWaiting(registration);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && active) {
            if (navigator.serviceWorker.controller) setWaiting(registration);
            else setStatus("Офлайн доступен");
          }
        });
      });
      await navigator.serviceWorker.ready;
      if (active) { setStatus("Офлайн доступен"); window.dispatchEvent(new Event("tasktracker:offline-ready")); }
    })().catch(() => { if (active) setStatus("Офлайн-загрузка недоступна"); });
    return () => { active = false; navigator.serviceWorker.removeEventListener("controllerchange", change); };
  }, []);
  if (waiting) return <div className="glass runtime-notice" role="status">Есть обновление<button className="secondary" onClick={() => { reload.current = true; waiting.waiting?.postMessage("SKIP_WAITING"); }}>Обновить</button></div>;
  return status ? <div className="glass runtime-notice" role="status"><span aria-hidden="true">◈</span>{status}<button className="secondary" aria-label="Скрыть уведомление" onClick={() => setStatus("")}>×</button></div> : null;
}
