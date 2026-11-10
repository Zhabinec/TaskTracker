import type { Page } from "@playwright/test";

export async function pwaDiagnostics(page: Page) {
  return page.evaluate(async () => ({
    controller: navigator.serviceWorker.controller?.scriptURL,
    registrations: (await navigator.serviceWorker.getRegistrations()).map(reg => ({ installing: reg.installing?.state, active: reg.active?.state, script: reg.active?.scriptURL, waiting: reg.waiting?.state })),
    caches: await Promise.all((await caches.keys()).map(async name => {
      const cache = await caches.open(name);
      return { name, login: Boolean(await cache.match("/login")), projects: Boolean(await cache.match("/projects")), keys: await Promise.all((await cache.keys()).map(async key => ({ url: key.url, request: Object.fromEntries(key.headers), response: Object.fromEntries((await cache.match(key, { ignoreVary: true }))!.headers) }))) };
    })),
  }));
}
