import { expect, test } from "@playwright/test";
import { shellProxy } from "./shell-proxy";
import { pwaDiagnostics } from "./pwa-diagnostics";

test("persistent installation failure stops and allows an explicit retry", async ({ page, context, baseURL }) => {
  const proxy = await shellProxy(baseURL!, "persistent");
  try {
    await page.goto(`${proxy.origin}/login`);
    await expect(page.getByRole("button", { name: "Retry offline setup", exact: true })).toBeVisible();
    expect(proxy.requests()).toBe(2);
    await expect(page.getByRole("status").filter({ hasText: "Offline ready" })).not.toBeVisible();
    proxy.release();
    await page.getByRole("button", { name: "Retry offline setup", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Offline ready" })).toBeVisible({ timeout: 30000 });
    expect(proxy.requests()).toBe(3);
    await context.setOffline(true); await page.reload();
    await expect(page.getByRole("heading", { name: "Your space", exact: true })).toBeVisible();
  } finally { await proxy.close(); }
});

test("first offline preparation survives navigation while assets are still installing", async ({ page, context, baseURL }) => {
  const proxy = await shellProxy(baseURL!, "hold");
  try {
    await page.goto(`${proxy.origin}/login`);
    await expect.poll(proxy.requests).toBe(1);
    await page.getByRole("button", { name: "Get started" }).click();
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Offline ready" })).not.toBeVisible();
    proxy.release();
    await expect(page.getByRole("status").filter({ hasText: "Offline ready" })).toBeVisible({ timeout: 30000 });
    await context.setOffline(true); await page.reload();
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  } finally { await proxy.close(); }
});

test("first installation recovers after one failed precache request", async ({ page, context, baseURL }, testInfo) => {
  const proxy = await shellProxy(baseURL!, "once");
  try {
    await page.goto(`${proxy.origin}/login`);
    await expect(page.getByRole("status").filter({ hasText: "Offline ready" })).toBeVisible({ timeout: 30000 });
    expect(proxy.requests()).toBeGreaterThanOrEqual(2);
    await page.getByRole("button", { name: "Get started" }).click();
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    await context.setOffline(true); await page.reload();
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  } catch (cause) {
    const state = await pwaDiagnostics(page);
    console.log("Failed installation state:", JSON.stringify(state));
    await testInfo.attach("installation-state", { body: JSON.stringify(state), contentType: "application/json" });
    throw cause;
  } finally { await proxy.close(); }
});
