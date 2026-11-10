import { expect, test } from "@playwright/test";

test("icon actions stay centered across viewport sizes and respect reduced motion", async ({ page }) => {
  await page.goto("/login"); await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("New project", { exact: true }).fill("Visual workspace");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page.getByLabel("Task", { exact: true }).fill("A task with a clear edit action");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit task: A task with a clear edit action", exact: true })).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const actions = await page.locator("button.icon-button").evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().width > 0).map(element => {
      const button = element.getBoundingClientRect(); const icon = element.querySelector("svg")!.getBoundingClientRect();
      return { label: element.getAttribute("aria-label"), width: button.width, height: button.height, x: Math.abs(button.x + button.width / 2 - icon.x - icon.width / 2), y: Math.abs(button.y + button.height / 2 - icon.y - icon.height / 2) };
    }));
    for (const action of actions) { expect(action.label).toBeTruthy(); expect(action.width).toBeGreaterThanOrEqual(44); expect(action.height).toBeGreaterThanOrEqual(44); expect(action.x).toBeLessThanOrEqual(1); expect(action.y).toBeLessThanOrEqual(1); }
    if ([390, 768, 1440].includes(width)) await page.screenshot({ path: `test-results/visual-workspace-${width}.png`, fullPage: true, animations: "disabled" });
  }
  await page.getByRole("button", { name: "Edit task: A task with a clear edit action", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit task", exact: true });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => getComputedStyle(element).animationName)).not.toBe("none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await dialog.evaluate(element => getComputedStyle(element).animationName)).toBe("none");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test("the task surface opens a focused dialog and saves title, date and status together", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login"); await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("New project", { exact: true }).fill("Task dialog");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page.getByLabel("Task", { exact: true }).fill("Open from the status");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Status: Open from the status", { exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit task", exact: true });
  const input = dialog.getByLabel("Task", { exact: true });
  await expect(input).toBeFocused();
  await input.fill("Renamed in the dialog");
  await dialog.getByLabel("Due date", { exact: true }).fill("2026-12-25");
  await dialog.getByRole("combobox", { name: "Task status", exact: true }).selectOption("Done");
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    // Native dialogs may hand focus to browser chrome between cycles; underlying
    // application controls must stay inert throughout.
    expect(await dialog.evaluate(element => document.activeElement === document.body || document.activeElement === document.documentElement || element.contains(document.activeElement))).toBe(true);
  }
  expect(await dialog.evaluate(element => element.matches(":modal"))).toBe(true);
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/task-dialog-mobile.png", fullPage: true });
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const task = page.getByRole("button", { name: "Edit task: Renamed in the dialog", exact: true });
  await expect(task).toBeFocused();
  await expect(task.getByLabel("Status: Renamed in the dialog", { exact: true })).toHaveText("Done");
  await expect(task.locator("time")).toHaveAttribute("datetime", "2026-12-25");
  await page.keyboard.press("Enter"); await input.fill("Discard the close-button edit");
  await dialog.getByRole("button", { name: "Close edit task", exact: true }).click();
  await expect(task).toBeFocused();
  await page.reload();
  await expect(task).toBeVisible();
  await expect(page.getByText(/^Saved drafts/)).not.toBeVisible();
});

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
  await expect(page.getByLabel("Status: Keep in progress", { exact: true })).toHaveText("In progress");
  await page.reload();
  await expect(page.getByLabel("Status: Keep in progress", { exact: true })).toHaveText("In progress");
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
  await expect(page.getByRole("heading", { name: "Second phone project", exact: true })).toBeVisible();
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
