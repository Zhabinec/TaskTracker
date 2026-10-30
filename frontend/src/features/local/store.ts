import { validDate, validName, validStatus } from "./contracts";
import type { LocalProfile, Project, Task, TaskPage, TaskStatus } from "./contracts";
import { parseBackup, backupLimit } from "./backup";
import type { WorkspaceBackup } from "./backup";

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
export async function createTask(projectId: string, title: string, dueDate: string, status: TaskStatus = "Todo"): Promise<void> {
  await createTasks(projectId, [title], dueDate, status);
}
export async function createTasks(projectId: string, titles: string[], dueDate: string, status: TaskStatus): Promise<void> {
  if (!titles.length || titles.length > 100) throw new Error("Add 1 to 100 tasks at a time.");
  const normalized = titles.map(title => validName(title, 200)); const date = validDate(dueDate); validStatus(status);
  const db = await database(); const tx = db.transaction(["tasks", "projects"], "readwrite"); const done = committed(tx);
  try {
    const projects = tx.objectStore("projects"); const project: Project | undefined = await result(projects.get(projectId));
    if (!project) throw new Error("Project not found. Refresh the list.");
    const now = new Date().toISOString(); const tasks = tx.objectStore("tasks");
    for (const title of normalized) tasks.add({ id: crypto.randomUUID(), projectId, title, dueDate: date, status, createdAt: now, completedAt: status === "Done" ? now : null, version: 1 } satisfies Task);
    projects.put({ ...project, taskCount: project.taskCount + normalized.length, doneCount: project.doneCount + (status === "Done" ? normalized.length : 0), updatedAt: now });
  } catch (error) { tx.abort(); await done.catch(() => {}); throw error; }
  await done; changed();
}
export async function editTask(task: Task, title: string, dueDate: string, status: TaskStatus = task.status): Promise<void> {
  const normalized = validName(title, 200); const date = validDate(dueDate); validStatus(status);
  const db = await database(); const tx = db.transaction(["tasks", "projects"], "readwrite"); const done = committed(tx);
  try {
    const tasks = tx.objectStore("tasks"); const current: Task | undefined = await result(tasks.get(task.id));
    if (!current || current.version !== task.version) throw new Error("This task changed in another tab. Cancel and reopen it to retry.");
    const projects = tx.objectStore("projects"); const project: Project | undefined = await result(projects.get(current.projectId));
    if (!project) throw new Error("Project not found.");
    tasks.put({ ...current, title: normalized, dueDate: date, status, completedAt: status === "Done" ? current.completedAt ?? new Date().toISOString() : null, version: current.version + 1 });
    projects.put({ ...project, doneCount: project.doneCount - (current.status === "Done" ? 1 : 0) + (status === "Done" ? 1 : 0), updatedAt: new Date().toISOString() });
  } catch (error) { tx.abort(); await done.catch(() => {}); throw error; }
  await done; changed();
}
export async function changeTask(task: Task, status: TaskStatus | "delete"): Promise<void> {
  await changeTasks([task], status);
}
export async function changeTasks(selected: Task[], status: TaskStatus | "delete"): Promise<void> {
  if (!selected.length || selected.length > 100 || new Set(selected.map(task => task.id)).size !== selected.length) throw new Error("Select 1 to 100 different tasks.");
  if (status !== "delete") validStatus(status);
  const db = await database(); const tx = db.transaction(["tasks", "projects"], "readwrite"); const done = committed(tx);
  try {
    const tasks = tx.objectStore("tasks"); const projects = tx.objectStore("projects");
    const now = new Date().toISOString();
    for (const task of selected) {
      const current: Task | undefined = await result(tasks.get(task.id));
      if (!current || current.version !== task.version) throw new Error("A task changed in another tab. Clear the selection and retry.");
      const project: Project | undefined = await result(projects.get(current.projectId));
      if (!project) throw new Error("Project not found.");
      if (status === "delete") tasks.delete(task.id);
      else tasks.put({ ...current, status, completedAt: status === "Done" ? current.completedAt ?? now : null, version: current.version + 1 });
      projects.put({ ...project, taskCount: project.taskCount - (status === "delete" ? 1 : 0), doneCount: project.doneCount - (current.status === "Done" ? 1 : 0) + (status === "Done" ? 1 : 0), updatedAt: now });
    }
  } catch (error) { tx.abort(); await done.catch(() => {}); throw error; }
  await done; changed();
}

export async function exportWorkspace(): Promise<string> {
  const db = await database(); const tx = db.transaction(["projects", "tasks"]); const done = committed(tx);
  const [projects, tasks] = await Promise.all([
    result<Project[]>(tx.objectStore("projects").getAll(undefined, 1001)),
    result<Task[]>(tx.objectStore("tasks").getAll(undefined, 20001)),
  ]);
  await done;
  if (projects.length > 1000 || tasks.length > 20000) throw new Error("Export supports up to 1,000 projects and 20,000 tasks.");
  const data: WorkspaceBackup = { format: "tasktracker-backup", version: 1, exportedAt: new Date().toISOString(), projects, tasks };
  const source = JSON.stringify(data, null, 2);
  if (new TextEncoder().encode(source).byteLength > backupLimit) throw new Error("Backup exceeds 5 MB.");
  return source;
}
export async function importWorkspace(source: string): Promise<void> {
  // Validate again at the write boundary; never trust a UI preview object.
  const data = parseBackup(source);
  const ids = new Map(data.projects.map(project => [project.id, crypto.randomUUID()]));
  const db = await database(); const tx = db.transaction(["projects", "tasks"], "readwrite"); const done = committed(tx);
  try {
    for (const project of data.projects) tx.objectStore("projects").add({ ...project, id: ids.get(project.id)! });
    for (const task of data.tasks) tx.objectStore("tasks").add({ ...task, id: crypto.randomUUID(), projectId: ids.get(task.projectId)! });
  } catch (error) { tx.abort(); await done.catch(() => {}); throw error; }
  await done; changed();
}
