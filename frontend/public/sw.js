const build = new URL(self.location.href).searchParams.get("build") || "local-v1";
const CACHE = `tasktracker-shell-${build}`;
const pages = ["/login", "/projects"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const assets = new Set(["/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png", "/fonts/jakarta-latin.woff2", "/fonts/inter-latin.woff2", "/fonts/inter-cyrillic.woff2"]);
    for (const page of pages) {
      const response = await fetch(page, { cache: "reload" });
      if (!response.ok) throw new Error("Offline shell unavailable");
      const html = await response.clone().text();
      await cache.put(page, response);
      for (const match of html.matchAll(/(?:src|href)="([^"\s]+)"/g)) {
        const url = new URL(match[1].replaceAll("&amp;", "&"), self.location.origin);
        if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) assets.add(url.pathname);
      }
    }
    await cache.addAll([...assets]);
    if (!self.registration.active) await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith("tasktracker-shell-") && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/health/")) return;
  if (request.mode === "navigate") {
    if (!["/", "/register", ...pages].includes(url.pathname)) return;
    const page = url.pathname === "/" ? "/projects" : url.pathname === "/register" ? "/login" : url.pathname;
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      // Keep the shell and its hashed chunks from the same build together.
      const cached = await cache.match(page);
      return cached || fetch(request);
    })());
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/icon") || url.pathname === "/manifest.webmanifest") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});
