import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import { getProject, listProjects, readDraft } from "../src/features/local/store";

it("upgrades v2 without replacing a saved edit or its original task version", async () => {
  vi.stubGlobal("window", Object.assign(new EventTarget(), { indexedDB })); vi.stubGlobal("BroadcastChannel", undefined);
  const previous = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("tasktracker-local", 2);
    request.onupgradeneeded = () => {
      const db = request.result; db.createObjectStore("profiles", { keyPath: "key" });
      const projects = db.createObjectStore("projects", { keyPath: "id" }); projects.createIndex("recent", ["updatedAt", "id"]);
      const tasks = db.createObjectStore("tasks", { keyPath: "id" }); tasks.createIndex("project", ["projectId", "createdAt", "id"]); tasks.createIndex("status", ["projectId", "status", "createdAt", "id"]);
      const drafts = db.createObjectStore("drafts", { keyPath: "id" }); drafts.createIndex("project", ["projectId", "updatedAt", "id"]);
    };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const date = "2026-10-30T12:00:00.000Z";
  const project = { id: "p", name: "Existing v2 project", color: "blue", taskCount: 1, doneCount: 0, createdAt: date, updatedAt: date };
  const task = { id: "t", projectId: "p", title: "Original", status: "Todo", dueDate: null, completedAt: null, createdAt: date, version: 5 };
  const draft = { id: "draft", projectId: "p", kind: "editor", task, data: { single: "Unfinished v2 edit", multiple: "", mode: "single", dueDate: "", status: "Todo" }, version: 7, updatedAt: date };
  await new Promise<void>((resolve, reject) => {
    const tx = previous.transaction(["projects", "tasks", "drafts"], "readwrite"); tx.objectStore("projects").add(project); tx.objectStore("tasks").add(task); tx.objectStore("drafts").add(draft);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
  previous.close();
  expect(await readDraft(draft.id)).toEqual(draft);
  expect(await getProject(project.id)).toEqual({ ...project, state: "active", version: 1 });
  expect((await listProjects(50, "active")).items.map(value => value.id)).toEqual(["p"]);
});
