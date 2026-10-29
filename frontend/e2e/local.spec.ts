import { expect, test } from "@playwright/test";

test("open without credentials, create a project and keep tasks offline after reload", async ({ page, context }) => {
  const apiCalls: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/")) apiCalls.push(request.url()); });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Моё пространство" })).toBeVisible();
  await page.screenshot({ path: "test-results/entry-desktop.png", fullPage: true, animations: "disabled" });
  await page.getByLabel("Название пространства").fill("Мои идеи");
  await page.getByRole("button", { name: "Начать" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByLabel("Новый проект", { exact: true }).fill("Запуск продукта");
  await page.getByRole("button", { name: "Создать проект" }).click();
  await expect(page.getByRole("heading", { name: "Запуск продукта" })).toBeVisible();
  await page.getByLabel("Задача", { exact: true }).fill("Собрать прототип");
  await page.getByLabel("Дедлайн", { exact: true }).fill("2026-12-20");
  await page.getByRole("button", { name: "Добавить задачу" }).click();
  await expect(page.getByText("Собрать прототип", { exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Офлайн доступен" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Собрать прототип", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Начать: Собрать прототип", exact: true }).click();
  await page.getByRole("button", { name: "Завершить: Собрать прототип", exact: true }).click();
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await expect(page.getByText("Собрать прототип", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Вернуть: Собрать прототип", exact: true })).toBeVisible();
  await page.getByLabel("Задача", { exact: true }).fill("Проверить офлайн");
  await page.getByRole("button", { name: "Добавить задачу" }).click();
  await expect(page.getByText("Проверить офлайн", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/workspace-desktop.png", fullPage: true });
  expect(apiCalls).toEqual([]);
});

test("offline shell works on the first local setup and preserves project isolation", async ({ page, context }) => {
  await page.goto("/login");
  await expect(page.getByRole("status").filter({ hasText: "Офлайн доступен" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Начать" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  for (const name of ["Личное", "Рабочее"]) {
    await page.getByLabel("Новый проект", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Создать проект" }).click();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await page.getByLabel("Задача", { exact: true }).fill("Только рабочая задача");
  await page.getByRole("button", { name: "Добавить задачу" }).click();
  await expect(page.getByText("Только рабочая задача", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Личное/ }).click();
  await expect(page.getByText("Только рабочая задача", { exact: true })).not.toBeVisible();
  await page.getByRole("link", { name: "Настроить локальное пространство" }).click();
  await expect(page.getByRole("button", { name: "Продолжить" })).toBeVisible();
});

test("glass interface is responsive and respects reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Моё пространство" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("Название пространства").focus();
  await page.getByLabel("Название пространства").fill("А".repeat(60));
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Начать" })).toBeFocused();
  await page.screenshot({ path: "test-results/entry-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Начать" }).click();
  await page.getByLabel("Новый проект", { exact: true }).fill("Очень длинное название мобильного проекта для проверки переноса текста");
  await page.getByRole("button", { name: "Создать проект" }).click();
  await expect(page.getByRole("heading", { name: /Очень длинное/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/workspace-mobile.png", fullPage: true });
});

test("changes in another tab refresh the current project without network calls", async ({ page, context }) => {
  await page.goto("/login"); await page.getByRole("button", { name: "Начать" }).click();
  await page.getByLabel("Новый проект", { exact: true }).fill("Общий локальный проект");
  await page.getByRole("button", { name: "Создать проект" }).click();
  const second = await context.newPage(); await second.goto("/projects");
  await expect(second.getByRole("heading", { name: "Общий локальный проект" })).toBeVisible();
  await page.getByLabel("Задача", { exact: true }).fill("Изменение из другой вкладки");
  await page.getByRole("button", { name: "Добавить задачу" }).click();
  await expect(second.getByText("Изменение из другой вкладки", { exact: true })).toBeVisible();
});

test("a service worker update keeps the local workspace intact", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Начать" }).click();
  await page.getByLabel("Новый проект", { exact: true }).fill("Проект переживает обновление");
  await page.getByRole("button", { name: "Создать проект" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Офлайн доступен" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register(`/sw.js?build=e2e-${crypto.randomUUID()}`, { scope: "/", updateViaCache: "none" });
  });
  await expect(page.getByRole("button", { name: "Обновить", exact: true })).toBeVisible();
  await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Обновить", exact: true }).click()]);
  await expect(page.getByRole("heading", { name: "Проект переживает обновление" })).toBeVisible();
});
