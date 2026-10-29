import { expect, test } from "@playwright/test";

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
  await page.getByRole("button", { name: "Start: Build a prototype", exact: true }).click();
  await page.getByRole("button", { name: "Complete: Build a prototype", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByText("Build a prototype", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Reopen: Build a prototype", exact: true })).toBeVisible();
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
  await expect(second.getByRole("button", { name: "Start: Shared task", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit task: Shared task", exact: true }).click();
  const editor = page.getByRole("form", { name: "Edit task", exact: true });
  await editor.getByLabel("Task", { exact: true }).fill("My unsaved draft");
  await second.getByRole("button", { name: "Start: Shared task", exact: true }).click();
  await expect(second.getByRole("button", { name: "Complete: Shared task", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete: Shared task", exact: true })).toBeVisible();
  await expect(editor.getByLabel("Task", { exact: true })).toHaveValue("My unsaved draft");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("another tab");
  await expect(editor.getByLabel("Task", { exact: true })).toHaveValue("My unsaved draft");
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit task: Shared task", exact: true })).toBeFocused();
});
