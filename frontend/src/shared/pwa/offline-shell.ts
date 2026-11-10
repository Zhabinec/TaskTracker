class InstallationFailed extends Error {}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    if (signal.aborted) { void promise.catch(() => {}); reject(signal.reason); return; }
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

function activated(registration: ServiceWorkerRegistration, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const workers = new Set<ServiceWorker>();
    const finish = (error?: unknown) => {
      registration.removeEventListener("updatefound", inspect);
      signal.removeEventListener("abort", abort);
      for (const worker of workers) worker.removeEventListener("statechange", inspect);
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(signal.reason);
    function inspect() {
      if (signal.aborted) { abort(); return; }
      if (registration.active?.state === "activated") { finish(); return; }
      const current = [registration.installing, registration.waiting, registration.active].filter((worker): worker is ServiceWorker => Boolean(worker));
      for (const worker of current) if (!workers.has(worker)) { workers.add(worker); worker.addEventListener("statechange", inspect); }
      if (!current.length || [...workers].every(worker => worker.state === "redundant")) finish(new InstallationFailed("Offline installation failed."));
    }
    registration.addEventListener("updatefound", inspect);
    signal.addEventListener("abort", abort, { once: true });
    inspect();
  });
}

function controlled(registration: ServiceWorkerRegistration, signal: AbortSignal): Promise<void> {
  const container = navigator.serviceWorker;
  return new Promise((resolve, reject) => {
    const finish = (error?: unknown) => {
      container.removeEventListener("controllerchange", inspect);
      signal.removeEventListener("abort", abort);
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(signal.reason);
    function inspect() { if (signal.aborted) abort(); else if (container.controller?.state === "activated") finish(); }
    container.addEventListener("controllerchange", inspect);
    signal.addEventListener("abort", abort, { once: true });
    inspect();
    if (!container.controller && !signal.aborted) {
      try { registration.active?.postMessage("CLAIM_CLIENTS"); } catch (cause) { finish(cause); }
    }
  });
}

function observeUpdates(registration: ServiceWorkerRegistration, signal: AbortSignal, onWaiting: (registration?: ServiceWorkerRegistration) => void) {
  const workers = new Set<ServiceWorker>();
  function inspect() {
    if (signal.aborted) return;
    onWaiting(registration.waiting ? registration : undefined);
    for (const worker of [registration.installing, registration.waiting, registration.active]) {
      if (worker && !workers.has(worker)) { workers.add(worker); worker.addEventListener("statechange", inspect); }
    }
  }
  function dispose() {
    registration.removeEventListener("updatefound", inspect);
    signal.removeEventListener("abort", dispose);
    for (const worker of workers) worker.removeEventListener("statechange", inspect);
  }
  registration.addEventListener("updatefound", inspect);
  signal.addEventListener("abort", dispose, { once: true });
  inspect();
  return dispose;
}

export async function prepareOfflineShell(signal: AbortSignal, onWaiting: (registration?: ServiceWorkerRegistration) => void): Promise<void> {
  const startup = new AbortController();
  const abort = () => startup.abort(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const deadline = setTimeout(() => startup.abort(new Error("Offline preparation timed out.")), 25000);
  let dispose: (() => void) | undefined;
  try {
    let build: string;
    try {
      const response = await fetch("/build-info.json", { cache: "no-store", signal: startup.signal });
      if (!response.ok) throw new Error("Build information unavailable.");
      const info: unknown = await response.json();
      if (!info || typeof info !== "object" || !("build" in info) || typeof info.build !== "string" || !info.build.trim()) throw new Error("Invalid build information.");
      build = info.build;
    } catch (cause) {
      startup.signal.throwIfAborted();
      if (navigator.serviceWorker.controller?.state === "activated") return;
      throw cause;
    }
    const existing = await abortable(navigator.serviceWorker.getRegistration("/"), startup.signal);
    const candidate = [existing?.installing, existing?.waiting, existing?.active].find(worker => {
      if (!worker) return false;
      const url = new URL(worker.scriptURL);
      return url.pathname === "/sw.js" && url.searchParams.get("build") === build;
    });
    const newInstallation = () => `/sw.js?build=${encodeURIComponent(build)}&installation=${crypto.randomUUID()}`;
    let script = candidate?.scriptURL ?? newInstallation();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      startup.signal.throwIfAborted();
      const registration = await abortable(navigator.serviceWorker.register(script, { scope: "/", updateViaCache: "none" }), startup.signal);
      dispose?.(); dispose = observeUpdates(registration, signal, onWaiting);
      try {
        await activated(registration, startup.signal);
        await controlled(registration, startup.signal);
        return;
      } catch (cause) {
        if (!(cause instanceof InstallationFailed) || attempt > 0 || navigator.serviceWorker.controller || navigator.onLine === false || startup.signal.aborted) throw cause;
        dispose(); dispose = undefined; script = newInstallation();
      }
    }
  } catch (cause) { dispose?.(); throw cause; }
  finally { clearTimeout(deadline); signal.removeEventListener("abort", abort); }
}
