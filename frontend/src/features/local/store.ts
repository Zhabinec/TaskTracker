import { localToday, validDate, validDescription, validName, validStatus } from "./contracts";
import type { DueFilter, LocalProfile, Project, Task, TaskPage, TaskStatus } from "./contracts";
import { parseBackup, backupLimit } from "./backup";
import type { WorkspaceBackup } from "./backup";
import type { Draft, DraftContent, DraftReceipt } from "./draft-contracts";

let opened: Promise<IDBDatabase> | undefined;
let channel: BroadcastChannel | undefined;
function events() {
  if (!channel && typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel("tasktracker-local");
  return channel;
}
function changed() { window.dispatchEvent(new Event("tasktracker:changed")); events()?.postMessage("changed"); }
export function subscribeChanges(listener: () => void) {
  window.addEventListener("tasktracker:changed", listener);
  const bus = events(); const receive = (event: MessageEvent) => { if (event.data !== "draft") listener(); };
  bus?.addEventListener("message", receive);
  return () => { window.removeEventListener("tasktracker:changed", listener); bus?.removeEventListener("message", receive); };
}
function database(): Promise<IDBDatabase> {
  if (!opened) opened = new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error("This browser does not support local storage.")); return; }
    const request = indexedDB.open("tasktracker-local", 3);
    request.onupgradeneeded = event => {
      const db = request.result;
      if (event.oldVersion < 2) { const drafts = db.createObjectStore("drafts", { keyPath: "id" }); drafts.createIndex("project", ["projectId", "updatedAt", "id"]); }
      if (event.oldVersion >= 1) {
        if (event.oldVersion < 3) {
          const projects = request.transaction!.objectStore("projects"); projects.createIndex("state", ["state", "updatedAt", "id"]);
          const cursor = projects.openCursor(); cursor.onsuccess = () => { const entry = cursor.result; if (entry) { entry.update({ ...entry.value, state: entry.value.state ?? "active", version: entry.value.version ?? 1 }); entry.continue(); } };
        }
        return;
      }
      db.createObjectStore("profiles", { keyPath: "key" });
      const projects = db.createObjectStore("projects", { keyPath: "id" });
      projects.createIndex("recent", ["updatedAt", "id"]);
      projects.createIndex("state", ["state", "updatedAt", "id"]);
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
  try { void navigator.storage?.persist?.().catch(() => {}); } catch { /* Persistence is optional and must never block opening the workspace. */ }
}
export async function listProjects(limit = 50, state: "active" | "archived" | "all" = "all"): Promise<{ items: Project[]; more: boolean }> {
  const db = await database(); const request = db.transaction("projects").objectStore("projects").index(state === "all" ? "recent" : "state").openCursor(state === "all" ? null : IDBKeyRange.bound([state], [state, []]), "prev");
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
export async function createProject(name: string, draft?: DraftReceipt): Promise<Project> {
  const normalized = validName(name, 100); const now = new Date().toISOString();
  const project: Project = { id: crypto.randomUUID(), name: normalized, color: ["violet", "coral", "blue"][crypto.getRandomValues(new Uint8Array(1))[0] % 3], taskCount: 0, doneCount: 0, createdAt: now, updatedAt: now, state: "active", version: 1 };
  const db = await database(); const tx = db.transaction(["projects", "drafts"], "readwrite"); const done = committed(tx);
  try { await finishDraft(tx, draft); tx.objectStore("projects").add(project); }
  catch (error) { tx.abort(); await done.catch(() => {}); throw error; }
  await done; changed(); draftsChanged(); return project;
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
export async function createTasks(projectId: string, titles: string[], dueDate: string, status: TaskStatus, draft?: DraftReceipt, description = ""): Promise<void> {
  if (!titles.length || titles.length > 100) throw new Error("Add 1 to 100 tasks at a time.");
  description = validDescription(description);
  const normalized = titles.map(title => validName(title, 200)); const date = validDate(dueDate); validStatus(status);
  const db = await database(); const tx = db.transaction(["tasks", "projects", "drafts"], "readwrite"); const done = committed(tx);
  try {
    await finishDraft(tx, draft);
    const projects = tx.objectStore("projects"); const project: Project | undefined = await result(projects.get(projectId));
    if (!project) throw new Error("Project not found. Refresh the list.");
    ensureActive(project);
    const now = new Date().toISOString(); const tasks = tx.objectStore("tasks");
    for (const title of normalized) tasks.add({ id: crypto.randomUUID(), projectId, title, dueDate: date, status, description, createdAt: now, completedAt: status === "Done" ? now : null, version: 1 } satisfies Task);
    projects.put({ ...project, taskCount: project.taskCount + normalized.length, doneCount: project.doneCount + (status === "Done" ? normalized.length : 0), updatedAt: now });
  } catch (error) { tx.abort(); await done.catch(() => {}); throw error; }
  await done; changed(); if (draft) draftsChanged();
}
export async function editTask(task: Task, title: string, dueDate: string, status: TaskStatus = task.status, draft?: DraftReceipt, details?: { description: string; projectId: string }): Promise<void> {
  const normalized = validName(title, 200); const date = validDate(dueDate); validStatus(status);
  const description = validDescription(details?.description ?? task.description ?? "");
  const destination = details?.projectId ?? task.projectId;
  const db = await database(); const tx = db.transaction(["tasks", "projects", "drafts"], "readwrite"); const done = committed(tx);
  try {
    await finishDraft(tx, draft);
    const tasks = tx.objectStore("tasks"); const current: Task | undefined = await result(tasks.get(task.id));
    if (!current || current.version !== task.version) throw new Error("This task changed in another tab. Cancel and reopen it to retry.");
    const projects = tx.objectStore("projects"); const source: Project | undefined = await result(projects.get(current.projectId));
    const target: Project | undefined = destination === current.projectId ? source : await result(projects.get(destination));
    if (!source || !target) throw new Error("Project not found."); ensureActive(source); ensureActive(target);
    const now = new Date().toISOString();
    tasks.put({ ...current, projectId: destination, title: normalized, description, dueDate: date, status, completedAt: status === "Done" ? current.completedAt ?? now : null, version: current.version + 1 });
    if (source.id === target.id) projects.put({ ...source, doneCount: source.doneCount - (current.status === "Done" ? 1 : 0) + (status === "Done" ? 1 : 0), updatedAt: now });
    else {
      projects.put({ ...source, taskCount: source.taskCount - 1, doneCount: source.doneCount - (current.status === "Done" ? 1 : 0), updatedAt: now });
      projects.put({ ...target, taskCount: target.taskCount + 1, doneCount: target.doneCount + (status === "Done" ? 1 : 0), updatedAt: now });
    }
  } catch (error) { tx.abort(); await done.catch(() => {}); throw error; }
  await done; changed(); if (draft) draftsChanged();
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
      if (!project) throw new Error("Project not found."); ensureActive(project);
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
  const data: WorkspaceBackup = { format: "tasktracker-backup", version: 2, exportedAt: new Date().toISOString(), projects, tasks };
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


function draftsChanged() { window.dispatchEvent(new Event("tasktracker:drafts")); events()?.postMessage("draft"); }
export function subscribeDraftChanges(listener: () => void) {
  window.addEventListener("tasktracker:drafts", listener);
  const bus = events(); const receive = (event: MessageEvent) => { if (event.data === "draft") listener(); };
  bus?.addEventListener("message", receive);
  return () => { window.removeEventListener("tasktracker:drafts", listener); bus?.removeEventListener("message", receive); };
}
export async function readDraft(id: string): Promise<Draft | undefined> {
  const db = await database(); return result(db.transaction("drafts").objectStore("drafts").get(id));
}
export async function listDrafts(projectId: string, limit = 100): Promise<{ items: Draft[]; more: boolean }> {
  const db = await database(); const request = db.transaction("drafts").objectStore("drafts").index("project")
    .openCursor(IDBKeyRange.bound([projectId], [projectId, []]), "prev");
  return new Promise((resolve, reject) => {
    const items: Draft[] = []; request.onerror = () => reject(request.error);
    request.onsuccess = () => { const cursor = request.result; if (!cursor || items.length === limit) { resolve({ items, more: Boolean(cursor) }); return; } items.push(cursor.value as Draft); cursor.continue(); };
  });
}
export async function saveDraft(id: string, content: DraftContent, version: number): Promise<Draft> {
  validStatus(content.data.status); validDate(content.data.dueDate); validDescription(content.data.description ?? "");
  if (content.data.single.length > 200 || content.data.multiple.length > 20100) throw new Error("Draft is too long.");
  const db = await database(); const tx = db.transaction("drafts", "readwrite"); const done = committed(tx);
  const saved: Draft = { ...content, id, version: version + 1, updatedAt: new Date().toISOString() };
  try {
    const store = tx.objectStore("drafts"); const current: Draft | undefined = await result(store.get(id));
    if ((current?.version ?? 0) !== version) throw new Error("Draft changed in another tab. Keep your copy to continue.");
    store.put(saved);
  } catch (error) { tx.abort(); await done.catch(() => {}); throw error; }
  await done; draftsChanged(); return saved;
}
async function finishDraft(tx: IDBTransaction, receipt?: DraftReceipt): Promise<void> {
  if (!receipt) return;
  const drafts = tx.objectStore("drafts"); const current: Draft | undefined = await result(drafts.get(receipt.id));
  if (!current || current.version !== receipt.version) throw new Error("Draft changed in another tab. Keep your copy to continue.");
  if (receipt.remainder) drafts.put({ ...receipt.remainder, id: receipt.id, version: receipt.version + 1, updatedAt: new Date().toISOString() } satisfies Draft);
  else drafts.delete(receipt.id);
}
export async function discardDraft(receipt: DraftReceipt): Promise<void> {
  const db = await database(); const tx = db.transaction("drafts", "readwrite"); const done = committed(tx);
  try { await finishDraft(tx, { id: receipt.id, version: receipt.version }); }
  catch (error) { tx.abort(); await done.catch(() => {}); throw error; }
  await done; draftsChanged();
}


function ensureActive(project: Project) { if (project.state === "archived") throw new Error("Restore this project before changing its tasks."); }
export async function getProject(id: string): Promise<Project | undefined> {
  const db = await database(); return result(db.transaction("projects").objectStore("projects").get(id));
}
export async function updateProject(project: Project, name: string, state: "active" | "archived", draft?: DraftReceipt): Promise<void> {
  const normalized = validName(name, 100);
  if (!["active", "archived"].includes(state)) throw new Error("Invalid project state.");
  const db = await database(); const tx = db.transaction(["projects", "drafts"], "readwrite"); const done = committed(tx);
  try {
    await finishDraft(tx, draft);
    const store = tx.objectStore("projects"); const current: Project | undefined = await result(store.get(project.id));
    if (!current || (current.version ?? 1) !== (project.version ?? 1)) throw new Error("Project changed in another tab. Reopen its settings.");
    store.put({ ...current, name: normalized, state, version: (current.version ?? 1) + 1, updatedAt: new Date().toISOString() });
  } catch (error) { tx.abort(); await done.catch(() => {}); throw error; }
  await done; changed(); if (draft) draftsChanged();
}
export async function moveTasks(selected: Task[], projectId: string): Promise<void> {
  if (!selected.length || selected.length > 100 || new Set(selected.map(task => task.id)).size !== selected.length) throw new Error("Select 1 to 100 different tasks.");
  const db = await database(); const tx = db.transaction(["tasks", "projects"], "readwrite"); const done = committed(tx);
  try {
    const tasks = tx.objectStore("tasks"); const projects = tx.objectStore("projects"); const now = new Date().toISOString();
    for (const task of selected) {
      const current: Task | undefined = await result(tasks.get(task.id));
      if (!current || current.version !== task.version) throw new Error("A task changed in another tab. Clear the selection and retry.");
      const source: Project | undefined = await result(projects.get(current.projectId)); const target: Project | undefined = await result(projects.get(projectId));
      if (!source || !target) throw new Error("Project not found."); ensureActive(source); ensureActive(target);
      if (source.id === target.id) continue;
      tasks.put({ ...current, projectId, version: current.version + 1 });
      projects.put({ ...source, taskCount: source.taskCount - 1, doneCount: source.doneCount - (current.status === "Done" ? 1 : 0), updatedAt: now });
      projects.put({ ...target, taskCount: target.taskCount + 1, doneCount: target.doneCount + (current.status === "Done" ? 1 : 0), updatedAt: now });
    }
  } catch (error) { tx.abort(); await done.catch(() => {}); throw error; }
  await done; changed();
}


export type TaskCursor = { scope: string; createdAt: string; id: string };
export async function queryTasks(projectId: string, status: TaskStatus | "all", search = "", due: DueFilter = "all", after?: TaskCursor): Promise<{ items: Task[]; more: boolean; cursor?: TaskCursor }> {
  if (status !== "all") validStatus(status);
  if (!["all", "today", "overdue", "upcoming", "undated"].includes(due)) throw new Error("Invalid due date filter.");
  const needle = search.trim().toLowerCase(); if (needle.length > 200) throw new Error("Search is too long.");
  const today = localToday(); const scope = JSON.stringify([projectId, status, needle, due, today]);
  if (after && after.scope !== scope) throw new Error("Search changed. Start a new page.");
  const prefix = status === "all" ? [projectId] : [projectId, status];
  const upper = after ? [...prefix, after.createdAt, after.id] : [...prefix, []];
  const db = await database(); const request = db.transaction("tasks").objectStore("tasks").index(status === "all" ? "project" : "status").openCursor(IDBKeyRange.bound(prefix, upper, false, Boolean(after)), "prev");
  return new Promise((resolve, reject) => {
    const items: Task[] = []; let scanned = 0; let cursorKey: TaskCursor | undefined;
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) { resolve({ items, more: false }); return; }
      if (scanned >= 500 || items.length >= 50) { resolve({ items, more: true, cursor: cursorKey }); return; }
      const task = cursor.value as Task; scanned++; cursorKey = { scope, createdAt: task.createdAt, id: task.id };
      const matchesText = !needle || `${task.title}\n${task.description ?? ""}`.toLowerCase().includes(needle);
      const matchesDate = due === "all" || (due === "undated" ? !task.dueDate : Boolean(task.dueDate) && (due === "today" ? task.dueDate === today : due === "overdue" ? task.dueDate! < today && task.status !== "Done" : task.dueDate! > today));
      if (matchesText && matchesDate) items.push(task); cursor.continue();
    };
  });
}
