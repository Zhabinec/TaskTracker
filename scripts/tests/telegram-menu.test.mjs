import { test } from "node:test";
import assert from "node:assert/strict";
import { configureTelegramMenu, telegramSettings } from "../telegram-menu.mjs";

const env = { TELEGRAM_BOT_TOKEN: "123456:test-token", TELEGRAM_BOT_USERNAME: "TaskTrackerPetBot", TELEGRAM_MINI_APP_URL: "https://tasks.example.com/login" };
const settings = telegramSettings(env);
const target = { type: "web_app", text: "Open app", web_app: { url: settings.url } };
const bot = { is_bot: true, username: settings.username, has_main_web_app: false };
function fixture({ identity = bot, menu = { type: "default" }, healthy = true, verify = true } = {}) {
  const calls = [];
  let changed = false;
  const request = async (url, options) => {
    const method = new URL(url).pathname.split("/").at(-1);
    calls.push({ method, body: options.body ? Object.fromEntries(new URLSearchParams(options.body)) : undefined });
    if (method === "ready") return Response.json({ status: healthy ? "ok" : "error" });
    const result = method === "getMe" ? identity
      : method === "getChatMenuButton" ? (changed && verify ? target : menu)
      : method === "setChatMenuButton" ? (changed = new URLSearchParams(options.body).has("menu_button")) : undefined;
    assert.notEqual(result, undefined, "Unexpected API request");
    return Response.json({ ok: true, result });
  };
  return { request, calls };
}

test("rejects missing credentials and unsafe app URLs before any request", () => {
  assert.throws(() => telegramSettings({ ...env, TELEGRAM_BOT_TOKEN: "" }));
  for (const url of ["http://tasks.example.com/login", "https://user:password@tasks.example.com", "https://tasks.example.com/?token=secret", "https://tasks.example.com/#secret"]) {
    assert.throws(() => telegramSettings({ ...env, TELEGRAM_MINI_APP_URL: url }));
  }
});
test("a token for another bot cannot change any settings", async () => {
  const f = fixture({ identity: { ...bot, username: "AnotherBot" } });
  await assert.rejects(configureTelegramMenu(settings, { apply: true, request: f.request }), /different bot/);
  assert.deepEqual(f.calls.map(x => x.method), ["getMe"]);
});
test("preview only reads identity and the current menu", async () => {
  const f = fixture();
  const result = await configureTelegramMenu(settings, { request: f.request });
  assert.equal(result.status, "would-update");
  assert.equal(result.mainMiniAppConfigured, false);
  assert.deepEqual(result.menu, target);
  assert.deepEqual(f.calls.map(x => x.method), ["getMe", "getChatMenuButton"]);
  assert.ok(!JSON.stringify(result).includes(settings.token));
});
test("apply checks health, changes only the default menu and reads it back", async () => {
  const f = fixture();
  assert.equal((await configureTelegramMenu(settings, { apply: true, request: f.request })).status, "updated");
  assert.deepEqual(f.calls.map(x => x.method), ["getMe", "getChatMenuButton", "ready", "setChatMenuButton", "getChatMenuButton"]);
  assert.deepEqual(f.calls[3].body, { menu_button: JSON.stringify(target) });
});
test("an already configured button does not cause another mutation", async () => {
  const f = fixture({ menu: target });
  assert.equal((await configureTelegramMenu(settings, { apply: true, request: f.request })).status, "unchanged");
  assert.deepEqual(f.calls.map(x => x.method), ["getMe", "getChatMenuButton"]);
});
test("unhealthy app blocks menu mutation and an unverified mutation fails visibly", async () => {
  const unhealthy = fixture({ healthy: false });
  await assert.rejects(configureTelegramMenu(settings, { apply: true, request: unhealthy.request }), /health check failed/);
  assert.ok(!unhealthy.calls.some(x => x.method === "setChatMenuButton"));
  const unverified = fixture({ verify: false });
  await assert.rejects(configureTelegramMenu(settings, { apply: true, request: unverified.request }), /could not be verified/);
});
test("fetch and API failures never expose bot credentials", async () => {
  for (const request of [
    async () => { throw new Error(`Request failed: https://api.telegram.org/bot${settings.token}/getMe`); },
    async () => Response.json({ ok: false, description: settings.token }, { status: 401 }),
  ]) {
    await assert.rejects(configureTelegramMenu(settings, { request }), error => {
      assert.ok(!error.message.includes(settings.token));
      return true;
    });
  }
});
