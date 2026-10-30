import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function workspace(page: Page, name = "Drafts") {
  await page.goto("/login"); await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("New project", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
async function offlineReady(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: "Offline ready" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}
test("creation drafts survive project/filter switches and offline reload with both modes", async ({ page, context }) => {
  await workspace(page, "Project A");
  const composer = page.getByRole("form", { name: "Add tasks", exact: true });
  await composer.getByLabel("Task", { exact: true }).fill("Unfinished single");
  await composer.getByRole("combobox", { name: "New task status" }).selectOption("Done");
  await composer.getByLabel("Due date", { exact: true }).fill("2026-12-23");
  await composer.getByRole("button", { name: "Add multiple", exact: true }).click();
  await composer.getByLabel("Tasks · one per line").fill("Batch first\nBatch second");
  await expect(composer.getByRole("status")).toHaveText("Draft saved");
  await page.getByLabel("New project", { exact: true }).fill("Project B");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await composer.getByLabel("Task", { exact: true }).fill("B draft");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(composer.getByLabel("Task", { exact: true })).toHaveValue("B draft");
  await page.getByRole("button", { name: /^Project A/ }).click();
  await expect(composer.getByLabel("Tasks · one per line")).toHaveValue("Batch first\nBatch second");
  await offlineReady(page); await context.setOffline(true); await page.reload();
  await expect(page.getByRole("heading", { name: "Project A", exact: true })).toBeVisible();
  await expect(composer.getByLabel("Tasks · one per line")).toHaveValue("Batch first\nBatch second");
  await expect(composer.getByLabel("Due date")).toHaveValue("2026-12-23");
  await expect(composer.getByRole("combobox", { name: "New task status" })).toHaveValue("Done");
  await composer.getByRole("button", { name: "Add multiple tasks", exact: true }).click();
  await composer.getByRole("button", { name: "Single task", exact: true }).click();
  await expect(composer.getByLabel("Task", { exact: true })).toHaveValue("Unfinished single");
  await composer.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Status: Unfinished single", exact: true })).toHaveValue("Done");
  await page.reload();
  await expect(composer.getByLabel("Task", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: /^Project B/ }).click();
  await expect(composer.getByLabel("Task", { exact: true })).toHaveValue("B draft");
});

test("editing drafts resume after filters and reload, then disappear on Save or Cancel", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await workspace(page);
  await page.getByLabel("Task", { exact: true }).fill("Original");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByRole("button", { name: "Edit task: Original", exact: true }).click();
  const editor = page.getByRole("form", { name: "Edit task", exact: true });
  await editor.getByLabel("Task", { exact: true }).fill("Recovered edit");
  await editor.getByLabel("Due date").fill("2026-12-24");
  await editor.getByRole("combobox", { name: "Task status", exact: true }).selectOption("Done");
  await expect(editor.getByRole("status")).toHaveText("Draft saved");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByText("No done tasks", { exact: true })).toBeVisible();
  await page.getByText("Saved drafts (1)", { exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(editor.getByLabel("Task", { exact: true })).toHaveValue("Recovered edit");
  await page.reload();
  await page.getByText("Saved drafts (1)", { exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(editor.getByLabel("Due date")).toHaveValue("2026-12-24");
  await expect(editor.getByRole("combobox", { name: "Task status", exact: true })).toHaveValue("Done");
  await page.screenshot({ path: "test-results/recovered-draft-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Status: Recovered edit", exact: true })).toHaveValue("Done");
  await expect(page.getByText(/^Saved drafts/)).not.toBeVisible();
  await page.getByRole("button", { name: "Edit task: Recovered edit", exact: true }).click();
  await editor.getByLabel("Task", { exact: true }).fill("Discard me");
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await expect(page.getByText(/^Saved drafts/)).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Edit task: Recovered edit", exact: true })).toBeVisible();
});

test("two tabs editing one recovered draft retain independent copies on conflict", async ({ page, context }) => {
  await workspace(page);
  const first = page.getByRole("form", { name: "Add tasks", exact: true });
  await first.getByLabel("Task", { exact: true }).fill("First text");
  await expect(first.getByRole("status")).toHaveText("Draft saved");
  const secondPage = await context.newPage(); await secondPage.goto("/projects");
  await secondPage.getByText("Saved drafts (1)", { exact: true }).click();
  await secondPage.getByRole("button", { name: "Resume", exact: true }).click();
  const second = secondPage.getByRole("form", { name: "Add tasks", exact: true });
  await expect(second.getByLabel("Task", { exact: true })).toHaveValue("First text");
  await second.getByLabel("Task", { exact: true }).fill("Second tab text");
  await expect(second.getByRole("status")).toHaveText("Draft saved");
  await first.getByLabel("Task", { exact: true }).fill("First tab amended");
  await expect(first.getByRole("alert")).toContainText("Draft changed in another tab");
  await first.getByRole("button", { name: "Keep my copy", exact: true }).click();
  await expect(first.getByRole("status")).toHaveText("Draft saved");
  await page.reload(); await secondPage.reload();
  await expect(first.getByLabel("Task", { exact: true })).toHaveValue("First tab amended");
  await expect(second.getByLabel("Task", { exact: true })).toHaveValue("Second tab text");
});

test("an app update flushes input and restores the task and project drafts", async ({ page }) => {
  await workspace(page);
  await page.getByLabel("New project", { exact: true }).fill("Unfinished project");
  await page.getByLabel("Task", { exact: true }).fill("Survive app update");
  await offlineReady(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register(`/sw.js?build=draft-${crypto.randomUUID()}`, { scope: "/", updateViaCache: "none" });
  });
  await expect(page.getByRole("button", { name: "Update", exact: true })).toBeVisible();
  await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Update", exact: true }).click()]);
  await expect(page.getByLabel("New project", { exact: true })).toHaveValue("Unfinished project");
  await expect(page.getByLabel("Task", { exact: true })).toHaveValue("Survive app update");
});

test("a storage failure retains text, blocks unload and can be retried", async ({ page }) => {
  await workspace(page);
  const composer = page.getByRole("form", { name: "Add tasks", exact: true });
  await expect(composer.getByLabel("Task", { exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as typeof window & { restoreDraftPut: () => void }).restoreDraftPut = () => { IDBObjectStore.prototype.put = original; };
    IDBObjectStore.prototype.put = function(value: unknown, key?: IDBValidKey) {
      if (this.name === "drafts") throw new DOMException("Storage full", "QuotaExceededError");
      return original.call(this, value, key);
    };
  });
  await composer.getByLabel("Task", { exact: true }).fill("Keep this exact text");
  await expect(composer.getByRole("alert")).toContainText("Storage full");
  expect(await page.evaluate(() => { const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; })).toBe(true);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(composer.getByLabel("Task", { exact: true })).toHaveValue("Keep this exact text");
  await page.evaluate(() => (window as typeof window & { restoreDraftPut: () => void }).restoreDraftPut());
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(composer.getByRole("status")).toHaveText("Draft saved");
  await page.reload();
  await expect(composer.getByLabel("Task", { exact: true })).toHaveValue("Keep this exact text");
});


test("a new tab can recover drafts after the original tab was closed", async ({ page, context }) => {
  await workspace(page);
  await page.getByLabel("New project", { exact: true }).fill("Closed tab project");
  const composer = page.getByRole("form", { name: "Add tasks", exact: true });
  await composer.getByLabel("Task", { exact: true }).fill("Closed tab task");
  await expect(composer.getByRole("status")).toHaveText("Draft saved");
  const next = await context.newPage();
  await page.close(); await next.goto("/projects");
  await next.getByText("Project drafts (1)", { exact: true }).click();
  await next.getByRole("complementary", { name: "Projects", exact: true }).getByRole("button", { name: "Resume", exact: true }).click();
  await expect(next.getByLabel("New project", { exact: true })).toHaveValue("Closed tab project");
  await next.getByText("Saved drafts (1)", { exact: true }).click();
  await next.getByRole("region", { name: "Drafts", exact: true }).getByRole("button", { name: "Resume", exact: true }).click();
  await expect(next.getByRole("form", { name: "Add tasks", exact: true }).getByLabel("Task", { exact: true })).toHaveValue("Closed tab task");
});

test("a saved edit of a task deleted elsewhere can be added as new work", async ({ page, context }) => {
  await workspace(page);
  await page.getByLabel("Task", { exact: true }).fill("Deleted original");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const second = await context.newPage(); await second.goto("/projects");
  await page.getByRole("button", { name: "Edit task: Deleted original", exact: true }).click();
  const editor = page.getByRole("form", { name: "Edit task", exact: true });
  await editor.getByLabel("Task", { exact: true }).fill("Recover this work");
  await expect(editor.getByRole("status")).toHaveText("Draft saved");
  await second.getByRole("button", { name: "Delete task: Deleted original", exact: true }).click();
  await second.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await expect(second.getByText("No tasks yet", { exact: true })).toBeVisible();
  await expect(editor.getByLabel("Task", { exact: true })).toHaveValue("Recover this work");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("another tab");
  await editor.getByRole("button", { name: "Add as new task", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit task: Recover this work", exact: true })).toBeVisible();
  await expect(page.getByText(/^Saved drafts/)).not.toBeVisible();
});
