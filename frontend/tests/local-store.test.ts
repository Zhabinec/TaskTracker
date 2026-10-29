import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { changeTask, createProject, createTask, listProjects, listTasks, profile, saveProfile } from "../src/features/local/store";

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
