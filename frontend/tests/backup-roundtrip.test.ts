import "fake-indexeddb/auto";
import { beforeAll, expect, it, vi } from "vitest";
import { createProject, createTasks, exportWorkspace, importWorkspace, listProjects, listTasks } from "../src/features/local/store";

beforeAll(() => { vi.stubGlobal("window", Object.assign(new EventTarget(), { indexedDB })); vi.stubGlobal("BroadcastChannel", undefined); });
it("round trips an empty workspace without inventing data", async () => {
  const backup = await exportWorkspace(); expect(JSON.parse(backup)).toMatchObject({ version: 2, projects: [], tasks: [] });
  await importWorkspace(backup); expect((await listProjects()).items).toHaveLength(0);
});
it("round trips a thousand tasks and preserves completed counters", async () => {
  const project = await createProject("Large backup");
  for (let batch = 0; batch < 10; batch++) await createTasks(project.id, Array.from({ length: 100 }, (_, index) => `Task ${batch * 100 + index}`), "", batch % 2 ? "Done" : "Todo");
  const backup = await exportWorkspace(); await importWorkspace(backup);
  const projects = (await listProjects()).items;
  expect(projects).toHaveLength(2); expect(projects.every(value => value.taskCount === 1000 && value.doneCount === 500)).toBe(true);
  const copy = projects.find(value => value.id !== project.id)!;
  expect((await listTasks(copy.id, "all", 2000)).items).toHaveLength(1000);
});
