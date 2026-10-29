import { validDate, validName } from "./contracts";
import type { LocalProfile, Project, Task, TaskPage, TaskStatus } from "./contracts";

let opened: Promise<IDBDatabase> | undefined;
let channel: BroadcastChannel | undefined;
function events() {
  if (!channel && typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel("tasktracker-local");
  return channel;
}
function changed() { window.dispatchEvent(new Event("tasktracker:changed")); events()?.postMessage("changed"); }
export function subscribeChanges(listener: () => void) {
  window.addEventListener("tasktracker:changed", listener);
  const bus = events(); bus?.addEventListener("message", listener);
  return () => { window.removeEventListener("tasktracker:changed", listener); bus?.removeEventListener("message", listener); };
}
function database(): Promise<IDBDatabase> {
  if (!opened) opened = new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error("This browser does not support local storage.")); return; }
    const request = indexedDB.open("tasktracker-local", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("profiles", { keyPath: "key" });
      const projects = db.createObjectStore("projects", { keyPath: "id" });
      projects.createIndex("recent", ["updatedAt", "id"]);
      const tasks = db.createObjectStore("tasks", { keyPath: "id" });
      tasks.createIndex("project", ["projectId", "createdAt", "id"]);
      tasks.createIndex("status", ["projectId", "status", "createdAt", "id"]);
    };
    request.onerror = () => { opened = undefined; reject(new Error("Storage unavailable. Allow site data and retry.")); };
    request.onblocked = () => { opened = undefined; reject(new Error("Close other app tabs and retry.")); };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); opened = undefined; };
      resolve(db);
    };
  });
  return opened;
}
function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("Could not save your changes.")); });
}
export async function profile(): Promise<LocalProfile | undefined> {
  const db = await database();
  return result(db.transaction("profiles").objectStore("profiles").get("device"));
}
export async function saveProfile(name: string): Promise<void> {
  const normalized = validName(name || "Your space", 60);
  const db = await database(); const tx = db.transaction("profiles", "readwrite"); const done = committed(tx);
  const store = tx.objectStore("profiles");
  const previous: LocalProfile | undefined = await result(store.get("device"));
  store.put({ key: "device", id: previous?.id ?? crypto.randomUUID(), name: normalized, createdAt: previous?.createdAt ?? new Date().toISOString() } satisfies LocalProfile);
  await done; changed();
  try { await navigator.storage?.persist?.(); } catch { /* Persistence is optional; saving already succeeded. */ }
}
export async function listProjects(limit = 50): Promise<{ items: Project[]; more: boolean }> {
  const db = await database(); const request = db.transaction("projects").objectStore("projects").index("recent").openCursor(null, "prev");
  return new Promise((resolve, reject) => {
    const items: Project[] = [];
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || items.length === limit) { resolve({ items, more: Boolean(cursor) }); return; }
      items.push(cursor.value as Project); cursor.continue();
    };
  });
}
export async function createProject(name: string): Promise<Project> {
  const normalized = validName(name, 100); const now = new Date().toISOString();
  const project: Project = { id: crypto.randomUUID(), name: normalized, color: ["violet", "coral", "blue"][crypto.getRandomValues(new Uint8Array(1))[0] % 3], taskCount: 0, doneCount: 0, createdAt: now, updatedAt: now };
  const db = await database(); const tx = db.transaction("projects", "readwrite"); const done = committed(tx);
  tx.objectStore("projects").add(project); await done; changed(); return project;
}
export async function listTasks(projectId: string, status: TaskStatus | "all", limit = 50): Promise<TaskPage> {
  const db = await database(); const store = db.transaction("tasks").objectStore("tasks");
  const prefix = status === "all" ? [projectId] : [projectId, status];
  const range = IDBKeyRange.bound(prefix, [...prefix, []]);
  const request = store.index(status === "all" ? "project" : "status").openCursor(range, "prev");
  return new Promise((resolve, reject) => {
    const items: Task[] = []; request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || items.length === limit) { resolve({ items, more: Boolean(cursor) }); return; }
      items.push(cursor.value as Task); cursor.continue();
    };
  });
}
export async function createTask(projectId: string, title: string, dueDate: string): Promise<void> {
  const normalized = validName(title, 200); const date = validDate(dueDate);
  const db = await database(); const tx = db.transaction(["tasks", "projects"], "readwrite"); const done = committed(tx);
  try {
    const projects = tx.objectStore("projects"); const project: Project | undefined = await result(projects.get(projectId));
    if (!project) throw new Error("Project not found. Refresh the list.");
    const now = new Date().toISOString();
    tx.objectStore("tasks").add({ id: crypto.randomUUID(), projectId, title: normalized, dueDate: date, status: "Todo", createdAt: now, completedAt: null, version: 1 } satisfies Task);
    projects.put({ ...project, taskCount: project.taskCount + 1, updatedAt: now });
  } catch (error) { tx.abort(); await done.catch(() => {}); throw error; }
  await done; changed();
}
export async function changeTask(task: Task, status: TaskStatus | "delete"): Promise<void> {
  const db = await database(); const tx = db.transaction(["tasks", "projects"], "readwrite"); const done = committed(tx);
  try {
    const tasks = tx.objectStore("tasks"); const current: Task | undefined = await result(tasks.get(task.id));
    if (!current || current.version !== task.version) throw new Error("This task changed in another tab. Please retry.");
    const projects = tx.objectStore("projects"); const project: Project | undefined = await result(projects.get(current.projectId));
    if (!project) throw new Error("Project not found.");
    if (status === "delete") tasks.delete(task.id);
    else tasks.put({ ...current, status, completedAt: status === "Done" ? current.completedAt ?? new Date().toISOString() : null, version: current.version + 1 });
    projects.put({ ...project, taskCount: project.taskCount - (status === "delete" ? 1 : 0), doneCount: project.doneCount - (current.status === "Done" ? 1 : 0) + (status === "Done" ? 1 : 0), updatedAt: new Date().toISOString() });
  } catch (error) { tx.abort(); await done.catch(() => {}); throw error; }
  await done; changed();
}
