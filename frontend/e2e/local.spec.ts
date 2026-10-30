import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("open without credentials, create a project and keep tasks offline after reload", async ({ page, context }) => {
  const apiCalls: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/")) apiCalls.push(request.url()); });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Your space" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.getByRole("heading", { name: "Your space" }).evaluate(element => getComputedStyle(element).fontFamily)).toContain("Plus Jakarta Sans");
  expect(await page.locator("body").evaluate(element => getComputedStyle(element).fontFamily)).toContain("Inter");
  await page.screenshot({ path: "test-results/entry-desktop.png", fullPage: true, animations: "disabled" });
  await page.getByLabel("Workspace name").fill("My ideas");
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByLabel("New project", { exact: true }).fill("Product launch");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: "Product launch" })).toBeVisible();
  await page.getByLabel("Task", { exact: true }).fill("Build a prototype");
  await page.getByLabel("Due date", { exact: true }).fill("2026-12-20");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Build a prototype", { exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Offline ready" })).toBeVisible();
  expect(await page.evaluate(async () => {
    const fonts = await Promise.all(["jakarta-latin.woff2", "inter-latin.woff2", "inter-cyrillic.woff2"].map(name => caches.match(`/fonts/${name}`)));
    return fonts.every(response => response?.ok);
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  expect(await page.evaluate(async () => {
    const fonts = await document.fonts.load('600 28px "Plus Jakarta Sans"', "Projects");
    return fonts.length > 0 && fonts.every(font => font.status === "loaded");
  })).toBe(true);
  await expect(page.getByText("Build a prototype", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Status: Build a prototype", exact: true }).selectOption("InProgress");
  await expect(page.getByRole("combobox", { name: "Status: Build a prototype", exact: true })).toHaveValue("InProgress");
  await page.getByRole("combobox", { name: "Status: Build a prototype", exact: true }).selectOption("Done");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByText("Build a prototype", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Status: Build a prototype", exact: true })).toHaveValue("Done");
  await page.getByLabel("Task", { exact: true }).fill("Check offline");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Check offline", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/workspace-desktop.png", fullPage: true });
  expect(apiCalls).toEqual([]);
});

test("offline shell works on the first local setup and preserves project isolation", async ({ page, context }) => {
  await page.goto("/login");
  await expect(page.getByRole("status").filter({ hasText: "Offline ready" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  for (const name of ["Personal", "Work"]) {
    await page.getByLabel("New project", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await page.getByLabel("Task", { exact: true }).fill("Work task");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Work task", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Personal/ }).click();
  await expect(page.getByText("Work task", { exact: true })).not.toBeVisible();
  await page.getByRole("link", { name: "Workspace settings" }).click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
});

test("glass interface is responsive and respects reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Your space" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("Workspace name").focus();
  await page.getByLabel("Workspace name").fill("А".repeat(60));
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Get started" })).toBeFocused();
  await page.screenshot({ path: "test-results/entry-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("New project", { exact: true }).fill("A very long mobile project name to verify text wrapping");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: /A very long/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/workspace-mobile.png", fullPage: true });
});

test("changes in another tab refresh the current project without network calls", async ({ page, context }) => {
  await page.goto("/login"); await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("New project", { exact: true }).fill("Shared local project");
  await page.getByRole("button", { name: "Create project" }).click();
  const second = await context.newPage(); await second.goto("/projects");
  await expect(second.getByRole("heading", { name: "Shared local project" })).toBeVisible();
  await page.getByLabel("Task", { exact: true }).fill("Change from another tab");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(second.getByText("Change from another tab", { exact: true })).toBeVisible();
});

test("a service worker update keeps the local workspace intact", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("New project", { exact: true }).fill("Project survives an update");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Offline ready" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register(`/sw.js?build=e2e-${crypto.randomUUID()}`, { scope: "/", updateViaCache: "none" });
  });
  await expect(page.getByRole("button", { name: "Update", exact: true })).toBeVisible();
  await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Update", exact: true }).click()]);
  await expect(page.getByRole("heading", { name: "Project survives an update" })).toBeVisible();
});


test("edit a task offline, cancel with Escape and retain keyboard focus", async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("New project", { exact: true }).fill("Editing");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByLabel("Task", { exact: true }).fill("Original task");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Offline ready" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Edit task: Original task", exact: true }).click();
  const editor = page.getByRole("form", { name: "Edit task", exact: true });
  await expect(editor.getByLabel("Task", { exact: true })).toBeFocused();
  await editor.getByLabel("Task", { exact: true }).fill("Discard this draft");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Edit task: Original task", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await editor.getByLabel("Task", { exact: true }).fill("Updated task");
  await editor.getByLabel("Due date").fill("2026-12-21");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/task-editor-mobile.png", fullPage: true });
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit task: Updated task", exact: true })).toBeFocused();
  await page.reload();
  await expect(page.getByRole("button", { name: "Edit task: Updated task", exact: true })).toBeVisible();
  await expect(page.locator('time[datetime="2026-12-21"]')).toBeVisible();
  await page.setViewportSize({ width: 812, height: 375 });
  await page.getByRole("button", { name: "Edit task: Updated task", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test("another tab cannot silently overwrite an open task draft", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("New project", { exact: true }).fill("Conflict");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByLabel("Task", { exact: true }).fill("Shared task");
  await page.getByRole("button", { name: "Add task" }).click();
  const second = await context.newPage(); await second.goto("/projects");
  await expect(second.getByRole("combobox", { name: "Status: Shared task", exact: true })).toHaveValue("Todo");
  await page.getByRole("button", { name: "Edit task: Shared task", exact: true }).click();
  const editor = page.getByRole("form", { name: "Edit task", exact: true });
  await editor.getByLabel("Task", { exact: true }).fill("My unsaved draft");
  await second.getByRole("combobox", { name: "Status: Shared task", exact: true }).selectOption("InProgress");
  await expect(second.getByRole("combobox", { name: "Status: Shared task", exact: true })).toHaveValue("InProgress");
  await expect(editor.getByRole("combobox", { name: "Task status", exact: true })).toHaveValue("Todo");
  await expect(editor.getByLabel("Task", { exact: true })).toHaveValue("My unsaved draft");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("another tab");
  await expect(editor.getByLabel("Task", { exact: true })).toHaveValue("My unsaved draft");
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit task: Shared task", exact: true })).toBeFocused();
});


test("create completed tasks in bulk, move selected tasks and confirm deletion", async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("New project", { exact: true }).fill("Completed work");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Offline ready" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Add multiple", exact: true }).click();
  const composer = page.getByRole("form", { name: "Add tasks", exact: true });
  await composer.getByLabel("Tasks · one per line").fill("Already shipped\nAlready tested\nAlready reviewed");
  await composer.getByRole("combobox", { name: "New task status" }).selectOption("Done");
  await page.screenshot({ path: "test-results/batch-composer-mobile.png", fullPage: true });
  await composer.getByRole("button", { name: "Add multiple tasks", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "3 tasks saved in Done" })).toBeVisible();
  for (const title of ["Already shipped", "Already tested", "Already reviewed"]) {
    await expect(page.getByRole("combobox", { name: `Status: ${title}`, exact: true })).toHaveValue("Done");
  }
  await page.getByRole("button", { name: "Select tasks", exact: true }).click();
  await page.getByRole("checkbox", { name: "Select task: Already shipped", exact: true }).check();
  await page.getByRole("checkbox", { name: "Select task: Already tested", exact: true }).check();
  await page.getByRole("combobox", { name: "Selected tasks status", exact: true }).selectOption("Todo");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText("0 selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel selection", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Status: Already reviewed", exact: true })).toHaveValue("Done");
  await page.getByRole("button", { name: "To do", exact: true }).click();
  await page.getByRole("combobox", { name: "Status: Already shipped", exact: true }).selectOption("InProgress");
  await expect(page.getByRole("combobox", { name: "Status: Already shipped", exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "View In progress", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Status: Already shipped", exact: true })).toHaveValue("InProgress");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByRole("button", { name: "Select tasks", exact: true }).click();
  await page.getByRole("button", { name: "Select loaded (3)", exact: true }).click();
  await page.getByRole("button", { name: "Delete selected", exact: true }).click();
  const confirmation = page.getByRole("region", { name: "Confirm deletion" });
  await expect(confirmation).toContainText("Delete 3 tasks?");
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("3 selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete selected", exact: true }).click();
  await confirmation.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await expect(page.getByText("No tasks yet", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("No tasks yet", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test("export and restore a backup offline without overwriting existing projects", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("New project", { exact: true }).fill("Backup project");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByLabel("Task", { exact: true }).fill("Keep this work");
  await page.getByRole("combobox", { name: "New task status" }).selectOption("Done");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Status: Keep this work", exact: true })).toHaveValue("Done");
  await expect(page.getByRole("status").filter({ hasText: "Offline ready" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.getByText("Backups", { exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup", exact: true }).click();
  const download = await downloaded;
  const buffer = await readFile((await download.path())!);
  const backup = JSON.parse(buffer.toString("utf8"));
  expect(backup.projects).toHaveLength(1); expect(backup.tasks).toHaveLength(1);
  await page.getByLabel("Import backup", { exact: true }).setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from('{"version":999}') });
  await expect(page.getByRole("alert").filter({ hasText: "Unsupported backup" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Backup project/ })).toHaveCount(1);
  await page.getByLabel("Import backup", { exact: true }).setInputFiles({ name: "backup.json", mimeType: "application/json", buffer });
  await expect(page.getByText("1 project · 1 task. Imports as new copies.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Backup project/ })).toHaveCount(1);
  await page.getByRole("button", { name: "Import copies", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Backup project/ })).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole("button", { name: /^Backup project/ })).toHaveCount(2);
  await expect(page.getByRole("combobox", { name: "Status: Keep this work", exact: true })).toHaveValue("Done");
});
