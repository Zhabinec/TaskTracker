import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { saveDraft, readDraft, listDrafts, subscribeChanges, subscribeDraftChanges, exportWorkspace, importWorkspace, createTasks, changeTasks, editTask, changeTask, createProject, createTask, listProjects, listTasks, profile, saveProfile } from "../src/features/local/store";

beforeAll(() => {
  vi.stubGlobal("window", Object.assign(new EventTarget(), { indexedDB }));
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubGlobal("navigator", { storage: { persist: async () => false } });
});

describe("local IndexedDB transactions", () => {
  it("creates a device profile without credentials and keeps it on reopening", async () => {
    expect(await profile()).toBeUndefined();
    await saveProfile("  Мои планы  ");
    const first = await profile();
    expect(first?.name).toBe("Мои планы");
    expect(first).not.toHaveProperty("password");
    await saveProfile("Новое название");
    expect((await profile())?.id).toBe(first?.id);
  });

  it("commits task and counters together and rejects stale edits", async () => {
    const project = await createProject("Работа");
    await createTask(project.id, "  Подготовить релиз  ", "2026-12-20");
    const task = (await listTasks(project.id, "Todo")).items[0];
    expect(task.title).toBe("Подготовить релиз");
    await changeTask(task, "Done");
    const completed = (await listTasks(project.id, "Done")).items[0];
    expect(completed.completedAt).toBeTruthy();
    await changeTask(completed, "Done");
    expect((await listTasks(project.id, "Done")).items[0].completedAt).toBe(completed.completedAt);
    await expect(createTask(project.id, "Некорректная дата", "2026-02-30")).rejects.toThrow("due date");
    expect((await listTasks(project.id, "Todo")).items).toHaveLength(0);
    expect((await listProjects()).items.find(value => value.id === project.id)).toMatchObject({ taskCount: 1, doneCount: 1 });
    await expect(changeTask(task, "delete")).rejects.toThrow("another tab");
    const current = (await listTasks(project.id, "Done")).items[0];
    await changeTask(current, "delete");
    expect((await listProjects()).items.find(value => value.id === project.id)).toMatchObject({ taskCount: 0, doneCount: 0 });
  });

  it("rolls back missing projects and detects concurrent updates", async () => {
    await expect(createTask("missing", "Задача", "")).rejects.toThrow("Project not found");
    expect((await listTasks("missing", "all")).items).toHaveLength(0);
    const project = await createProject("Конкуренция");
    await createTask(project.id, "Одна задача", "");
    const task = (await listTasks(project.id, "all")).items[0];
    const results = await Promise.allSettled([changeTask(task, "Done"), changeTask(task, "InProgress")]);
    expect(results.filter(value => value.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(value => value.status === "rejected")).toHaveLength(1);
    expect((await listProjects()).items.find(value => value.id === project.id)?.taskCount).toBe(1);
  });

  it("bounds reads to the selected project and status", async () => {
    const first = await createProject("Первый"); const second = await createProject("Второй");
    await Promise.all(Array.from({ length: 52 }, (_, index) => createTask(first.id, `Задача ${index}`, "")));
    await createTask(second.id, "Другая задача", "");
    const page = await listTasks(first.id, "all");
    expect(page.items).toHaveLength(50); expect(page.more).toBe(true);
    expect(page.items.every(value => value.projectId === first.id)).toBe(true);
    expect((await listTasks(second.id, "all")).items).toHaveLength(1);
    const limited = await listProjects(1);
    expect(limited.items).toHaveLength(1); expect(limited.more).toBe(true);
  });
});

it("opens the workspace even when the optional persistence permission never resolves", async () => {
  vi.stubGlobal("navigator", { storage: { persist: () => new Promise<boolean>(() => {}) } });
  await saveProfile("Non-blocking storage");
  expect((await profile())?.name).toBe("Non-blocking storage");
  vi.stubGlobal("navigator", { storage: { persist: async () => false } });
});


it("edits content without changing status or counters and rejects stale drafts", async () => {
  const project = await createProject("Editing");
  await createTask(project.id, "Original", "2026-12-01");
  await changeTask((await listTasks(project.id, "all")).items[0], "Done");
  const original = (await listTasks(project.id, "all")).items[0];
  await editTask(original, "  Updated  ", "");
  const updated = (await listTasks(project.id, "all")).items[0];
  expect(updated).toMatchObject({ title: "Updated", dueDate: null, status: "Done", completedAt: original.completedAt, version: original.version + 1 });
  await expect(editTask(original, "Stale", "")).rejects.toThrow("another tab");
  await expect(editTask(updated, "Invalid", "2026-02-30")).rejects.toThrow("due date");
  expect((await listTasks(project.id, "all")).items[0]).toEqual(updated);
  expect((await listProjects()).items.find(value => value.id === project.id)).toMatchObject({ taskCount: 1, doneCount: 1 });
});


it("creates already completed tasks in one batch and keeps exact counters", async () => {
  const project = await createProject("Completed work");
  await createTasks(project.id, ["First", "Second", "Third"], "2026-12-20", "Done");
  const tasks = (await listTasks(project.id, "Done")).items;
  expect(tasks).toHaveLength(3);
  expect(tasks.every(task => task.completedAt && task.status === "Done")).toBe(true);
  expect((await listProjects()).items.find(value => value.id === project.id)).toMatchObject({ taskCount: 3, doneCount: 3 });
  await changeTasks(tasks, "Todo");
  const reopened = (await listTasks(project.id, "Todo")).items;
  expect(reopened.every(task => task.completedAt === null)).toBe(true);
  await changeTasks(reopened, "InProgress");
  expect((await listTasks(project.id, "InProgress")).items).toHaveLength(3);
  expect((await listProjects()).items.find(value => value.id === project.id)).toMatchObject({ taskCount: 3, doneCount: 0 });
});

it("rejects invalid batches before inserting any tasks", async () => {
  const project = await createProject("Invalid batches");
  await expect(createTasks(project.id, ["Valid", " "], "", "Done")).rejects.toThrow("characters");
  await expect(createTasks(project.id, [], "", "Todo")).rejects.toThrow("1 to 100");
  await expect(createTasks(project.id, Array(101).fill("Task"), "", "Todo")).rejects.toThrow("1 to 100");
  await expect(createTasks(project.id, ["Task"], "", "Invalid" as never)).rejects.toThrow("valid status");
  expect((await listTasks(project.id, "all")).items).toHaveLength(0);
  expect((await listProjects()).items.find(value => value.id === project.id)).toMatchObject({ taskCount: 0, doneCount: 0 });
});

it("rolls back the entire bulk action if any selected task has changed", async () => {
  const project = await createProject("Atomic bulk");
  await createTasks(project.id, ["One", "Two"], "", "Todo");
  const tasks = (await listTasks(project.id, "all")).items;
  await changeTask(tasks[1], "Done");
  await expect(changeTasks(tasks, "delete")).rejects.toThrow("another tab");
  expect((await listTasks(project.id, "all")).items).toHaveLength(2);
  expect((await listProjects()).items.find(value => value.id === project.id)).toMatchObject({ taskCount: 2, doneCount: 1 });
  await expect(changeTasks([tasks[0], tasks[0]], "Done")).rejects.toThrow("different tasks");
  const current = (await listTasks(project.id, "all")).items;
  await changeTasks(current, "delete");
  expect((await listProjects()).items.find(value => value.id === project.id)).toMatchObject({ taskCount: 0, doneCount: 0 });
});

it("can edit directly into Done and reopen without inflating progress", async () => {
  const project = await createProject("Explicit edit status");
  await createTask(project.id, "Task", "");
  let task = (await listTasks(project.id, "all")).items[0];
  await editTask(task, task.title, "", "Done");
  task = (await listTasks(project.id, "all")).items[0];
  const completedAt = task.completedAt;
  await editTask(task, "Renamed", "", "Done");
  task = (await listTasks(project.id, "all")).items[0];
  expect(task.completedAt).toBe(completedAt);
  expect((await listProjects()).items.find(value => value.id === project.id)?.doneCount).toBe(1);
  await editTask(task, task.title, "", "InProgress");
  expect((await listTasks(project.id, "all")).items[0].completedAt).toBeNull();
  expect((await listProjects()).items.find(value => value.id === project.id)?.doneCount).toBe(0);
});


it("restores backups as independent copies and recomputes project counters", async () => {
  const source = JSON.parse(await exportWorkspace());
  const before = (await listProjects(1000)).items;
  expect(source.projects).toHaveLength(before.length);
  for (const project of source.projects) { project.taskCount = 99999; project.doneCount = -1; }
  await importWorkspace(JSON.stringify(source));
  const after = (await listProjects(1000)).items;
  expect(after).toHaveLength(before.length * 2);
  const originalIds = new Set(before.map(project => project.id));
  const copies = after.filter(project => !originalIds.has(project.id));
  for (const project of copies) {
    const tasks = (await listTasks(project.id, "all", 1000)).items;
    expect(project.taskCount).toBe(tasks.length);
    expect(project.doneCount).toBe(tasks.filter(task => task.status === "Done").length);
    expect(tasks.every(task => !source.tasks.some((original: { id: string }) => original.id === task.id))).toBe(true);
  }
  await expect(importWorkspace(JSON.stringify({ ...source, tasks: [...source.tasks, { ...source.tasks[0], id: "orphan", projectId: "missing" }] }))).rejects.toThrow("no project");
  expect((await listProjects(1000)).items).toHaveLength(after.length);
});


it("version-checks drafts and commits task creation with draft removal atomically", async () => {
  const project = await createProject("Draft creation");
  const content = { projectId: project.id, kind: "composer" as const, data: { single: "New task", multiple: "", mode: "single" as const, dueDate: "", status: "Done" as const } };
  const draft = await saveDraft(crypto.randomUUID(), content, 0);
  await expect(createTasks(project.id, ["New task"], "", "Done", { id: draft.id, version: 999 })).rejects.toThrow("Draft changed");
  expect((await listTasks(project.id, "all")).items).toHaveLength(0);
  expect(await readDraft(draft.id)).toEqual(draft);
  await createTasks(project.id, ["New task"], "", "Done", draft);
  expect(await readDraft(draft.id)).toBeUndefined();
  expect((await listProjects(1000)).items.find(value => value.id === project.id)).toMatchObject({ taskCount: 1, doneCount: 1 });
  await expect(createTasks(project.id, ["Duplicate retry"], "", "Done", draft)).rejects.toThrow("Draft changed");
  expect((await listTasks(project.id, "all")).items).toHaveLength(1);
});

it("keeps saved edits when a task conflict aborts the entire transaction", async () => {
  const project = await createProject("Draft conflict");
  await createTask(project.id, "Original", ""); const task = (await listTasks(project.id, "all")).items[0];
  const draft = await saveDraft(crypto.randomUUID(), { projectId: project.id, kind: "editor", task, data: { single: "My draft", multiple: "", mode: "single", status: "Todo", dueDate: "" } }, 0);
  await changeTask(task, "Done");
  await expect(editTask(task, "My draft", "", "Todo", draft)).rejects.toThrow("another tab");
  expect(await readDraft(draft.id)).toEqual(draft);
  expect((await listTasks(project.id, "all")).items[0]).toMatchObject({ title: "Original", status: "Done" });
});

it("preserves the inactive creation mode when submitting the other draft", async () => {
  const project = await createProject("Two drafts");
  const content = { projectId: project.id, kind: "composer" as const, data: { single: "Single", multiple: "Batch one\nBatch two", mode: "single" as const, status: "Todo" as const, dueDate: "" } };
  const draft = await saveDraft(crypto.randomUUID(), content, 0);
  const remainder = { ...content, data: { ...content.data, single: "" } };
  await createTasks(project.id, ["Single"], "", "Todo", { ...draft, remainder });
  expect(await readDraft(draft.id)).toMatchObject({ version: 2, data: { single: "", multiple: "Batch one\nBatch two" } });
  const outcomes = await Promise.allSettled([saveDraft(draft.id, remainder, 2), saveDraft(draft.id, content, 2)]);
  expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(outcomes.filter(result => result.status === "rejected")).toHaveLength(1);
});

it("isolates draft reads and notifications from workspace list refreshes", async () => {
  const changed = vi.fn(); const draftsChanged = vi.fn();
  const stop = subscribeChanges(changed); const stopDrafts = subscribeDraftChanges(draftsChanged);
  const id = crypto.randomUUID();
  await saveDraft(id, { projectId: "isolated-drafts", kind: "composer", data: { single: "Text", multiple: "", mode: "single", dueDate: "", status: "Todo" } }, 0);
  expect(changed).not.toHaveBeenCalled(); expect(draftsChanged).toHaveBeenCalledTimes(1);
  expect((await listDrafts("isolated-drafts")).items.map(value => value.id)).toEqual([id]);
  expect((await listDrafts("another-project")).items).toHaveLength(0);
  stop(); stopDrafts();
});
