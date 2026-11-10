import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function changeTaskStatus(page: Page, title: string, status: "Todo" | "InProgress" | "Done") {
  await page.getByRole("button", { name: `Edit task: ${title}`, exact: true }).click();
  const editor = page.getByRole("form", { name: "Edit task", exact: true });
  await editor.getByRole("combobox", { name: "Task status", exact: true }).selectOption(status);
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor).not.toBeVisible();
}
