import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function project(page: Page, name: string) {
  await page.getByLabel("New project", { exact: true }).fill(name); await page.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
async function start(page: Page) { await page.goto("/login"); await page.getByRole("button", { name: "Get started" }).click(); }
test("rename, archive, reload and restore preserve tasks and descriptions", async ({ page, context }) => {
  await start(page); await project(page, "Lifecycle");
  await page.getByLabel("Task", { exact: true }).fill("A finished task");
  await page.getByRole("combobox", { name: "New task status", exact: true }).selectOption("Done");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByRole("button", { name: "Edit task: A finished task", exact: true }).click();
  const editor = page.getByRole("form", { name: "Edit task", exact: true });
  await editor.getByLabel("Description", { exact: true }).fill("Release notes\nCheck all browsers");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Release notes\nCheck all browsers", { exact: true })).toBeVisible();
  await page.getByText("Project settings", { exact: true }).click();
  await page.getByRole("button", { name: "Rename project", exact: true }).click();
  await page.getByLabel("Project name", { exact: true }).fill("Ready for release");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ready for release", exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Offline ready" })).toBeVisible({ timeout: 30000 });
  await context.setOffline(true);
  await page.getByText("Project settings", { exact: true }).click();
  await page.getByRole("button", { name: "Archive project", exact: true }).click();
  await expect(page.getByText("Archived · restore to make changes", { exact: true })).toBeVisible();
  await expect(page.getByRole("form", { name: "Add tasks", exact: true })).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ready for release", exact: true })).toBeVisible();
  await page.getByText("Project settings", { exact: true }).click();
  await page.getByRole("button", { name: "Restore project", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Status: A finished task", exact: true })).toHaveValue("Done");
  await expect(page.getByRole("form", { name: "Add tasks", exact: true })).toBeVisible();
});
test("move an edited task and selected tasks to an explicit destination", async ({ page }) => {
  await start(page); await project(page, "Destination"); await project(page, "Source");
  for (const title of ["Move individually", "Move selected"]) {
    await page.getByLabel("Task", { exact: true }).fill(title); await page.getByRole("button", { name: "Add task", exact: true }).click();
    await expect(page.getByRole("button", { name: `Edit task: ${title}`, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Edit task: Move individually", exact: true }).click();
  const editor = page.getByRole("form", { name: "Edit task", exact: true });
  await editor.getByRole("combobox", { name: "Task project", exact: true }).selectOption({ label: "Destination" });
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "1 task moved to Destination" })).toBeVisible();
  await page.getByRole("button", { name: "Select tasks", exact: true }).click();
  await page.getByRole("checkbox", { name: "Select task: Move selected", exact: true }).check();
  await page.getByRole("combobox", { name: "Move selected to", exact: true }).selectOption({ label: "Destination" });
  await page.getByRole("button", { name: "Move selected", exact: true }).click();
  await expect(page.getByText("No tasks yet", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View project", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Destination", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Edit task: Move/ })).toHaveCount(2);
  await page.reload(); await expect(page.getByRole("button", { name: /^Edit task: Move/ })).toHaveCount(2);
});
test("searches descriptions, filters due dates and continues past the first task page", async ({ page }) => {
  await start(page); await project(page, "Search");
  await page.getByRole("button", { name: "Add multiple", exact: true }).click();
  await page.getByLabel("Tasks · one per line", { exact: true }).fill(Array.from({ length: 62 }, (_, index) => `Work ${index}`).join("\n"));
  await page.getByRole("button", { name: "Add multiple tasks", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Edit task: Work/ })).toHaveCount(50);
  await page.getByRole("button", { name: "More tasks", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Edit task: Work/ })).toHaveCount(62);
  await page.getByRole("button", { name: "Edit task: Work 7", exact: true }).click();
  const editor = page.getByRole("form", { name: "Edit task", exact: true });
  await editor.getByLabel("Description", { exact: true }).fill("Unique release detail");
  await editor.getByLabel("Due date", { exact: true }).fill("2000-01-01");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search tasks", exact: true }).fill("unique release");
  await page.getByRole("combobox", { name: "Due date filter", exact: true }).selectOption("overdue");
  await expect(page.getByRole("button", { name: /^Edit task: Work/ })).toHaveCount(1);
  await page.getByRole("combobox", { name: "Status: Work 7", exact: true }).selectOption("Done");
  await expect(page.getByText("No matching tasks", { exact: true })).toBeVisible();
});
test("a selected project survives being pushed beyond the first project page", async ({ page }) => {
  await start(page); await project(page, "Pinned");
  // Restore a realistic large workspace through the public backup UI.
  const now = new Date().toISOString();
  const backup = { format: "tasktracker-backup", version: 2, exportedAt: now, tasks: [], projects: Array.from({ length: 60 }, (_, index) => ({ id: `p-${index}`, name: `Imported ${index}`, color: "violet", createdAt: now, updatedAt: "2090-01-01T00:00:00.000Z", state: "active" })) };
  await page.getByText("Backups", { exact: true }).click();
  await page.getByLabel("Import backup", { exact: true }).setInputFiles({ name: "projects.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole("button", { name: "Import copies", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Backup imported" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pinned", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Pinned/ })).toHaveAttribute("aria-pressed", "true");
  await page.reload(); await expect(page.getByRole("heading", { name: "Pinned", exact: true })).toBeVisible();
  await page.getByText("Backups", { exact: true }).click();
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name: "Export backup", exact: true }).click();
  const file = await pending; expect(JSON.parse(await readFile((await file.path())!, "utf8")).projects).toHaveLength(61);
});


test("an unfinished rename resumes after reload and keeps its original project version", async ({ page }) => {
  await start(page); await project(page, "Rename draft");
  await page.getByText("Project settings", { exact: true }).click();
  await page.getByRole("button", { name: "Rename project", exact: true }).click();
  await page.getByLabel("Project name", { exact: true }).fill("Recovered project name");
  await expect(page.getByRole("status").filter({ hasText: "Draft saved" })).toBeVisible();
  await page.reload();
  await page.getByText("Saved drafts (1)", { exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue("Recovered project name");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recovered project name", exact: true })).toBeVisible();
  await expect(page.getByText(/^Saved drafts/)).not.toBeVisible();
});
