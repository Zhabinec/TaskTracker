import "fake-indexeddb/auto";
import { beforeAll, expect, it, vi } from "vitest";
import { blankDraftData } from "../src/features/local/draft-contracts";
import { localToday } from "../src/features/local/contracts";
import { changeTask, createProject, createTask, createTasks, editTask, exportWorkspace, getProject, importWorkspace, listProjects, listTasks, moveTasks, queryTasks, readDraft, saveDraft, updateProject } from "../src/features/local/store";

beforeAll(() => { vi.stubGlobal("window", Object.assign(new EventTarget(), { indexedDB })); vi.stubGlobal("BroadcastChannel", undefined); });
it("archives without deleting tasks or drafts, blocks edits, and restores", async () => {
  const project = await createProject("Archive"); await createTask(project.id, "Keep", "", "Done");
  const draft = await saveDraft(crypto.randomUUID(), { projectId: project.id, kind: "composer", data: { ...blankDraftData(), single: "Keep draft" } }, 0);
  await updateProject(project, "Archive renamed", "archived");
  const archived = (await getProject(project.id))!;
  expect((await listProjects(100, "active")).items.some(value => value.id === project.id)).toBe(false);
  expect((await listProjects(100, "archived")).items).toContainEqual(archived);
  await expect(createTask(project.id, "Blocked", "")).rejects.toThrow("Restore");
  await expect(changeTask((await listTasks(project.id, "all")).items[0], "delete")).rejects.toThrow("Restore");
  expect(await readDraft(draft.id)).toEqual(draft);
  await expect(updateProject(project, "Stale", "active")).rejects.toThrow("another tab");
  await updateProject(archived, archived.name, "active");
  expect((await getProject(project.id))!).toMatchObject({ name: "Archive renamed", taskCount: 1, doneCount: 1, state: "active" });
});
it("moves tasks and status changes with exact counters and preserves completed time", async () => {
  const source = await createProject("Source"); const target = await createProject("Target");
  await createTasks(source.id, ["One", "Two"], "", "Done");
  const original = (await listTasks(source.id, "all")).items;
  await moveTasks(original, target.id);
  expect(await getProject(source.id)).toMatchObject({ taskCount: 0, doneCount: 0 });
  expect(await getProject(target.id)).toMatchObject({ taskCount: 2, doneCount: 2 });
  const moved = (await listTasks(target.id, "all")).items;
  expect(moved.every(task => original.some(previous => previous.id === task.id && previous.completedAt === task.completedAt && previous.createdAt === task.createdAt))).toBe(true);
  await editTask(moved[0], "With notes", "", "InProgress", undefined, { description: "Line one\nLine two", projectId: source.id });
  expect(await getProject(source.id)).toMatchObject({ taskCount: 1, doneCount: 0 });
  expect(await getProject(target.id)).toMatchObject({ taskCount: 1, doneCount: 1 });
  expect((await listTasks(source.id, "all")).items[0]).toMatchObject({ title: "With notes", description: "Line one\nLine two", completedAt: null });
});
it("rolls back every move if a selected task is stale or the target is archived", async () => {
  const source = await createProject("Atomic source"); const target = await createProject("Atomic target");
  await createTasks(source.id, ["One", "Two"], "", "Todo"); const tasks = (await listTasks(source.id, "all")).items;
  await changeTask(tasks[1], "Done");
  await expect(moveTasks(tasks, target.id)).rejects.toThrow("another tab");
  expect((await listTasks(source.id, "all")).items).toHaveLength(2);
  expect(await getProject(target.id)).toMatchObject({ taskCount: 0, doneCount: 0 });
  await updateProject(target, target.name, "archived");
  await expect(moveTasks((await listTasks(source.id, "all")).items, target.id)).rejects.toThrow("Restore");
});
it("paginates without repeating earlier rows and searches descriptions and local due dates", async () => {
  const project = await createProject("Pages"); await createTasks(project.id, Array.from({ length: 72 }, (_, index) => `Work ${index}`), "", "Todo");
  const first = await queryTasks(project.id, "all"); const second = await queryTasks(project.id, "all", "", "all", first.cursor);
  expect(first.items).toHaveLength(50); expect(second.items).toHaveLength(22); expect(second.more).toBe(false);
  expect(new Set([...first.items, ...second.items].map(task => task.id)).size).toBe(72);
  await expect(queryTasks(project.id, "all", "different", "all", first.cursor)).rejects.toThrow("Search changed");
  const task = first.items[0]; await editTask(task, task.title, localToday(), "Todo", undefined, { description: "Find this detail", projectId: project.id });
  expect((await queryTasks(project.id, "all", "THIS DETAIL", "today")).items).toHaveLength(1);
  await createTask(project.id, "Late", "2000-01-01"); await createTask(project.id, "Completed long ago", "2000-01-01", "Done");
  expect((await queryTasks(project.id, "all", "", "overdue")).items.map(task => task.title)).toEqual(["Late"]);
});
it("preserves archive and description in backup, and rolls back an import write failure", async () => {
  const source = JSON.parse(await exportWorkspace());
  expect(source.version).toBe(2);
  const before = (await listProjects(1000)).items.length;
  const add = IDBObjectStore.prototype.add;
  const failing = vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    if (this.name === "tasks") throw new DOMException("Storage full", "QuotaExceededError");
    return add.call(this, value, key);
  });
  await expect(importWorkspace(JSON.stringify(source))).rejects.toThrow("Storage full"); failing.mockRestore();
  expect((await listProjects(1000)).items).toHaveLength(before);
  await importWorkspace(JSON.stringify(source));
  const exported = JSON.parse(await exportWorkspace());
  expect(exported.tasks.filter((task: { description: string }) => task.description === "Line one\nLine two")).toHaveLength(2);
});
