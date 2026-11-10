import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { prepareOfflineShell } from "../src/shared/pwa/offline-shell";

class Worker extends EventTarget {
  state: ServiceWorkerState = "installing";
  scriptURL = "http://localhost/sw.js?build=build-one&installation=existing";
  postMessage = vi.fn();
  transition(state: ServiceWorkerState) { this.state = state; this.dispatchEvent(new Event("statechange")); }
}
class Registration extends EventTarget {
  installing: Worker | null = new Worker();
  waiting: Worker | null = null;
  active: Worker | null = null;
}
class Container extends EventTarget {
  register = vi.fn();
  getRegistration = vi.fn().mockResolvedValue(undefined);
  controller: Worker | null = null;
  get ready(): never { throw new Error("The global ready promise must not hide installation failure."); }
}
let container: Container;
let lifetime: AbortController;
beforeEach(() => {
  vi.useFakeTimers(); container = new Container(); lifetime = new AbortController();
  vi.stubGlobal("navigator", { serviceWorker: container, onLine: true });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ build: "build-one" }))));
});
afterEach(() => { lifetime.abort(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function provide(...registrations: Registration[]) { for (const registration of registrations) container.register.mockResolvedValueOnce(registration); }
function activate(registration: Registration, control = true) {
  const worker = registration.installing!; registration.active = worker; registration.installing = null;
  worker.transition("activated");
  if (control) { container.controller = worker; container.dispatchEvent(new Event("controllerchange")); }
}

it("waits for actual page control after activation instead of the global ready promise", async () => {
  const registration = new Registration(); provide(registration);
  const prepared = prepareOfflineShell(lifetime.signal, vi.fn());
  await vi.waitFor(() => expect(container.register).toHaveBeenCalledTimes(1));
  activate(registration, false);
  await vi.waitFor(() => expect(registration.active!.postMessage).toHaveBeenCalledWith("CLAIM_CLIENTS"));
  let ready = false; void prepared.then(() => { ready = true; }); await Promise.resolve(); expect(ready).toBe(false);
  container.controller = registration.active; container.dispatchEvent(new Event("controllerchange"));
  await prepared; expect(ready).toBe(true); expect(vi.getTimerCount()).toBe(0);
});

it("re-registers the same build once when first installation becomes redundant", async () => {
  const failed = new Registration(); const recovered = new Registration(); provide(failed, recovered);
  const prepared = prepareOfflineShell(lifetime.signal, vi.fn());
  await vi.waitFor(() => expect(container.register).toHaveBeenCalledTimes(1));
  const worker = failed.installing!; failed.installing = null; worker.transition("redundant");
  await vi.waitFor(() => expect(container.register).toHaveBeenCalledTimes(2));
  activate(recovered); await prepared;
  const scripts = container.register.mock.calls.map(args => new URL(args[0], "http://localhost"));
  expect(scripts.map(url => url.searchParams.get("build"))).toEqual(["build-one", "build-one"]);
  expect(scripts[0].searchParams.get("installation")).toBeTruthy();
  expect(scripts[1].searchParams.get("installation")).not.toBe(scripts[0].searchParams.get("installation"));
  expect(vi.getTimerCount()).toBe(0);
});
it("reuses a same-build installation across navigation instead of creating a false update", async () => {
  const registration = new Registration(); registration.active = new Worker(); registration.active.state = "activated"; registration.installing = null;
  container.controller = registration.active; container.getRegistration.mockResolvedValue(registration); provide(registration);
  await prepareOfflineShell(lifetime.signal, vi.fn());
  expect(container.register).toHaveBeenCalledWith(registration.active.scriptURL, { scope: "/", updateViaCache: "none" });
});

it("stops after two failed installations without extending the deadline", async () => {
  const first = new Registration(); first.installing!.state = "redundant";
  const second = new Registration(); second.installing!.state = "redundant"; provide(first, second);
  await expect(prepareOfflineShell(lifetime.signal, vi.fn())).rejects.toThrow("installation failed");
  expect(container.register).toHaveBeenCalledTimes(2); expect(vi.getTimerCount()).toBe(0);
});

it("keeps the current worker active and only advertises a waiting update", async () => {
  const registration = new Registration(); registration.active = new Worker(); registration.active.state = "activated";
  registration.waiting = new Worker(); registration.waiting.state = "installed"; registration.installing = null;
  container.controller = registration.active; provide(registration);
  const waiting = vi.fn(); await prepareOfflineShell(lifetime.signal, waiting);
  expect(waiting).toHaveBeenCalledWith(registration); expect(registration.waiting.postMessage).not.toHaveBeenCalled();
  const remove = vi.spyOn(registration.waiting, "removeEventListener"); lifetime.abort();
  expect(remove).toHaveBeenCalledWith("statechange", expect.any(Function));
});

it("cancels startup listeners and timers on navigation without retrying", async () => {
  const registration = new Registration(); provide(registration);
  const remove = vi.spyOn(registration.installing!, "removeEventListener");
  const prepared = prepareOfflineShell(lifetime.signal, vi.fn());
  await vi.waitFor(() => expect(container.register).toHaveBeenCalledTimes(1));
  lifetime.abort(); await expect(prepared).rejects.toMatchObject({ name: "AbortError" });
  expect(remove).toHaveBeenCalledWith("statechange", expect.any(Function));
  expect(container.register).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
});

it("bounds an unresponsive registration and ignores its late result", async () => {
  let resolve!: (registration: Registration) => void;
  container.register.mockReturnValue(new Promise<Registration>(done => { resolve = done; }));
  const waiting = vi.fn(); const prepared = prepareOfflineShell(lifetime.signal, waiting);
  const rejected = expect(prepared).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(25000); await rejected;
  resolve(new Registration()); await Promise.resolve(); expect(waiting).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("uses an already activated controller offline without registering an invented build", async () => {
  container.controller = new Worker(); container.controller.state = "activated";
  vi.mocked(fetch).mockRejectedValue(new TypeError("Offline"));
  await prepareOfflineShell(lifetime.signal, vi.fn()); expect(container.register).not.toHaveBeenCalled();
  container.controller = null;
  await expect(prepareOfflineShell(lifetime.signal, vi.fn())).rejects.toThrow("Offline");
  expect(container.register).not.toHaveBeenCalled();
});
