// Explicit operator rehearsal, never an unattended CI test: it waits for real
// Render deployments while retaining one isolated browser context and its data.
import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import process from "node:process";
import { URL } from "node:url";

const origin = new URL(process.env.REHEARSAL_ORIGIN ?? "https://tasktracker-7wc0.onrender.com");
if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("Use an exact public HTTPS origin.");
const directory = path.resolve(process.env.REHEARSAL_OUTPUT ?? "test-results/render-rehearsal");
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ baseURL: origin.origin, viewport: { width: 1280, height: 900 }, reducedMotion: "reduce", acceptDownloads: true });
const page = await context.newPage();
const report = { origin: origin.origin, startedAt: new Date().toISOString(), stages: [] };
async function checkpoint(stage, details = {}) {
  report.stages.push({ stage, time: new Date().toISOString(), ...details });
  await writeFile(path.join(directory, "result.json"), JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify({ stage, ...details })}\n`);
}
async function serverBuild() {
  const response = await context.request.get("/build-info.json", { headers: { "Cache-Control": "no-cache" }, timeout: 15000 });
  if (!response.ok()) throw new Error("Build information is unavailable.");
  const { build } = await response.json();
  if (typeof build !== "string" || !build) throw new Error("Missing build identifier.");
  return build;
}
async function waitForBuild(accept) {
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    try { const build = await serverBuild(); if (accept(build)) return build; } catch { /* A deployment may temporarily refuse a request. */ }
    await delay(2500);
  }
  throw new Error("Timed out waiting for the operator's real Render deployment.");
}
const title = "Retain task across deployments";
const projectDraft = "Unfinished release project";
let draft = "Retain this unfinished task";
let baseline;
async function verifyData() {
  await expect(page.getByRole("heading", { name: report.project, exact: true })).toBeVisible();
  await expect(page.getByLabel(`Status: ${title}`, { exact: true })).toHaveText("Done");
  await expect(page.getByLabel("Task", { exact: true })).toHaveValue(draft);
  await expect(page.getByLabel("New project", { exact: true })).toHaveValue(projectDraft);
}
async function backup(name) {
  const details = page.locator("details").filter({ has: page.getByText("Backups", { exact: true }) });
  if (!await details.getAttribute("open").then(value => value !== null)) await page.getByText("Backups", { exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup", exact: true }).click();
  const target = path.join(directory, `${name}.json`);
  await (await downloaded).saveAs(target);
  const value = JSON.parse(await readFile(target, "utf8"));
  if (baseline) {
    expect(value.format).toBe(baseline.format); expect(value.version).toBe(baseline.version);
    expect(value.projects).toEqual(baseline.projects); expect(value.tasks).toEqual(baseline.tasks);
  }
  return value;
}
async function verifyOffline(stage) {
  await expect(page.getByRole("status").filter({ hasText: "Offline ready" })).toBeVisible({ timeout: 30000 });
  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await verifyData();
    await page.screenshot({ path: path.join(directory, `${stage}.png`), fullPage: true });
  } finally { await context.setOffline(false); }
}
async function acceptDeployment(build, stage) {
  // Reopening the app is the existing update-discovery path, not a fake worker
  // registration or a call into application internals.
  await page.reload({ waitUntil: "domcontentloaded" });
  const update = page.getByRole("button", { name: "Update", exact: true });
  await expect(update).toBeVisible({ timeout: 60000 });
  draft += ` · ${stage}`;
  await page.getByLabel("Task", { exact: true }).fill(draft);
  await Promise.all([page.waitForEvent("load"), update.click()]);
  await verifyData();
  const activeBuild = await page.evaluate("new URL(navigator.serviceWorker.controller.scriptURL).searchParams.get('build')");
  expect(activeBuild).toBe(build);
  await backup(stage);
  await verifyOffline(stage);
  await checkpoint(stage, { build, activeBuild, backupUnchanged: true, draftsRetained: true, offlineReload: true });
}
try {
  const buildA = await serverBuild();
  if (process.env.REHEARSAL_EXPECTED_BUILD && process.env.REHEARSAL_EXPECTED_BUILD !== buildA) throw new Error("The public build changed before the rehearsal started.");
  await page.goto("/login");
  await page.getByLabel("Workspace name").fill("Release acceptance");
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  report.project = `Release rehearsal ${Date.now()}`;
  await page.getByLabel("New project", { exact: true }).fill(report.project);
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page.getByLabel("Task", { exact: true }).fill(title);
  await page.getByRole("combobox", { name: "New task status", exact: true }).selectOption("Done");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByLabel(`Status: ${title}`, { exact: true })).toHaveText("Done");
  baseline = await backup("baseline");
  expect(baseline.projects).toHaveLength(1); expect(baseline.tasks).toHaveLength(1);
  await page.getByLabel("Task", { exact: true }).fill(draft);
  await page.getByLabel("New project", { exact: true }).fill(projectDraft);
  await expect(page.getByRole("form", { name: "Add tasks", exact: true }).getByRole("status")).toHaveText("Draft saved");
  await verifyOffline("baseline");
  await checkpoint("A_prepared", { build: buildA, projectId: baseline.projects[0].id, taskId: baseline.tasks[0].id });
  const buildB = await waitForBuild(build => build !== buildA);
  await acceptDeployment(buildB, "B_verified");
  await waitForBuild(build => build === buildA);
  await acceptDeployment(buildA, "A_rollback_verified");
  await checkpoint("complete", { buildA, buildB });
} catch (error) {
  await checkpoint("failed", { error: error.message });
  await page.screenshot({ path: path.join(directory, "failure.png"), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally { await context.close(); await browser.close(); }
