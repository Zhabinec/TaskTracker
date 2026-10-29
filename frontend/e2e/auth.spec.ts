import { expect, test } from "@playwright/test";

const password = "a long password for browser tests";
const email = () => `browser-${crypto.randomUUID()}@example.com`;

test("register, reload, logout and login through the real interface", async ({ page, context, request }) => {
  const account = email();
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("link", { name: "Создать аккаунт" }).click();
  await page.getByLabel("Email", { exact: true }).fill(account);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  const registration = page.waitForResponse("**/api/auth/register");
  await page.getByRole("button", { name: "Создать аккаунт", exact: true }).click();
  const response = await registration;
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/json");
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByText(account, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(account, { exact: true })).toBeVisible();
  const session = (await context.cookies()).find(cookie => cookie.name === "tasktracker_session");
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
  expect(await page.evaluate(() => document.cookie)).not.toContain("tasktracker_session");
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await context.cookies()).some(cookie => cookie.name === "tasktracker_session")).toBe(false);
  const old = await request.get(`${process.env.E2E_API_URL ?? "http://127.0.0.1:8000"}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${session?.value}` },
  });
  expect(old.status()).toBe(401);
  await page.getByLabel("Email", { exact: true }).fill(account);
  await page.getByLabel("Пароль", { exact: true }).fill("incorrect password");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Неверный email или пароль" })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(account);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  expect((await context.cookies()).find(cookie => cookie.name === "tasktracker_session")?.value).not.toBe(session?.value);
});

test("reject foreign or missing Origin, oversized forms and forged logout", async ({ page, request }) => {
  const publicResponse = await request.post("/api/auth/register", {
    headers: { Origin: process.env.E2E_BASE_URL ?? "http://localhost:3000", Accept: "application/json" },
    form: { email: email(), password },
  });
  expect(publicResponse.ok()).toBe(true);
  expect(await publicResponse.json()).toEqual({ ok: true });
  const origins: Record<string, string>[] = [{ Origin: "https://evil.example" }, {}];
  for (const headers of origins) {
    const response = await request.post("/api/auth/login", {
      headers: { ...headers, Accept: "application/json" }, form: { email: email(), password },
    });
    expect(response.status()).toBe(403);
  }
  const oversized = await request.post("/api/auth/login", {
    headers: { Origin: process.env.E2E_BASE_URL ?? "http://localhost:3000", Accept: "application/json" },
    form: { email: email(), password: "a".repeat(9000) },
  });
  expect(oversized.status()).toBe(413);
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill(email());
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Создать аккаунт", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  const rejected = await page.evaluate(async () => {
    const response = await fetch("/api/auth/logout", { method: "POST", body: new URLSearchParams({ csrf_token: "wrong" }), headers: { Accept: "application/json" } });
    return response.status;
  });
  expect(rejected).toBe(403);
  await page.reload();
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("mobile login fits the viewport and supports keyboard navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Войти в TaskTracker" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("Email", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Пароль", { exact: true })).toBeFocused();
  await page.screenshot({ path: "test-results/login-mobile.png", fullPage: true });
});

test("native forms support registration and logout without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${process.env.E2E_BASE_URL ?? "http://localhost:3000"}/register`);
    await page.getByLabel("Email", { exact: true }).fill(email());
    await page.getByLabel("Пароль", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Создать аккаунт", exact: true }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
  } finally { await context.close(); }
});
