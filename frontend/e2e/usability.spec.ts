import { expect, test } from "@playwright/test";

test("moving to the current project never claims a status change", async ({ page }) => {
  await page.goto("/login"); await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("New project", { exact: true }).fill("Same destination");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page.getByLabel("Task", { exact: true }).fill("Keep in progress");
  await page.getByRole("combobox", { name: "New task status", exact: true }).selectOption("InProgress");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByRole("button", { name: "Select tasks", exact: true }).click();
  await page.getByRole("checkbox", { name: "Select task: Keep in progress", exact: true }).check();
  await page.getByRole("combobox", { name: "Move selected to", exact: true }).selectOption({ label: "Same destination" });
  await page.getByRole("button", { name: "Move selected", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Tasks already in this project." })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Status: Keep in progress", exact: true })).toHaveValue("InProgress");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Status: Keep in progress", exact: true })).toHaveValue("InProgress");
});

test("mobile management collapses without losing drafts and keeps progress available", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login"); await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("New project", { exact: true }).fill("Phone");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  const manage = page.getByRole("button", { name: "Manage", exact: true });
  await expect(manage).toHaveAttribute("aria-expanded", "false");
  await expect(manage).toBeFocused();
  await expect(page.getByLabel("New project", { exact: true })).not.toBeVisible();
  await page.getByLabel("Task", { exact: true }).fill("Finished on phone");
  await page.getByRole("combobox", { name: "New task status", exact: true }).selectOption("Done");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "Project completion", exact: true })).toHaveAttribute("value", "1");
  await expect(page.getByText("1 / 1 done · 100%", { exact: true })).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  const task = page.getByRole("button", { name: "Edit task: Finished on phone", exact: true });
  expect((await task.boundingBox())!.y).toBeLessThan(844);
  for (const locator of [manage, page.getByRole("button", { name: "All", exact: true }), page.getByRole("button", { name: "Dismiss task notice", exact: true }), page.getByRole("link", { name: "Workspace settings", exact: true })]) {
    const box = (await locator.boundingBox())!; expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await manage.click(); await page.getByLabel("New project", { exact: true }).fill("Unfinished project");
  await expect(page.locator("#project-management").getByRole("status").filter({ hasText: "Draft saved" })).toBeVisible();
  await manage.click(); await manage.click();
  await expect(page.getByLabel("New project", { exact: true })).toHaveValue("Unfinished project");
  await page.getByLabel("New project", { exact: true }).fill("Second phone project");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page.getByRole("combobox", { name: "Current project", exact: true }).selectOption({ label: "Phone" });
  await expect(task).toBeVisible();
  await manage.click(); await page.getByText("Backups", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Export backup", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("workspace retries a transient read failure without reloading", async ({ page }) => {
  await page.goto("/login"); await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await page.addInitScript(() => {
    if (location.pathname !== "/projects") return;
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function(...args: Parameters<typeof original>) {
      if (args[0] === "profiles") {
        IDBDatabase.prototype.transaction = original;
        throw new DOMException("Temporary read failure", "UnknownError");
      }
      return original.apply(this, args);
    };
  });
  await page.reload();
  await page.getByRole("button", { name: "Retry workspace", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry workspace", exact: true })).not.toBeVisible();
});
