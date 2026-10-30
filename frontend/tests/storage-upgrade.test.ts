import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import { listProjects, listTasks, readDraft } from "../src/features/local/store";

it("adds the draft store to v1 without replacing existing project and task data", async () => {
  vi.stubGlobal("window", Object.assign(new EventTarget(), { indexedDB })); vi.stubGlobal("BroadcastChannel", undefined);
  const previous = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("tasktracker-local", 1);
    request.onupgradeneeded = () => {
      const db = request.result; db.createObjectStore("profiles", { keyPath: "key" });
      const projects = db.createObjectStore("projects", { keyPath: "id" }); projects.createIndex("recent", ["updatedAt", "id"]);
      const tasks = db.createObjectStore("tasks", { keyPath: "id" }); tasks.createIndex("project", ["projectId", "createdAt", "id"]); tasks.createIndex("status", ["projectId", "status", "createdAt", "id"]);
    };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const date = "2026-10-30T12:00:00.000Z";
  const project = { id: "p", name: "Existing project", color: "coral", taskCount: 1, doneCount: 1, createdAt: date, updatedAt: date };
  const task = { id: "t", projectId: "p", title: "Existing work", status: "Done", dueDate: null, completedAt: date, createdAt: date, version: 4 };
  await new Promise<void>((resolve, reject) => {
    const tx = previous.transaction(["projects", "tasks"], "readwrite"); tx.objectStore("projects").add(project); tx.objectStore("tasks").add(task);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
  previous.close();
  expect((await listProjects()).items).toEqual([project]);
  expect((await listTasks("p", "Done")).items).toEqual([task]);
  expect(await readDraft("missing")).toBeUndefined();
});
