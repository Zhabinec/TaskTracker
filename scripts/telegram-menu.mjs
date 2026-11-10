import { pathToFileURL } from "node:url";

export function telegramSettings(env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const username = env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  if (!token || !/^\d+:[A-Za-z0-9_-]+$/.test(token)) throw new Error("Set TELEGRAM_BOT_TOKEN in the local environment file.");
  if (!username || !/^[A-Za-z0-9_]{5,32}$/.test(username)) throw new Error("Set the expected TELEGRAM_BOT_USERNAME.");
  let url;
  try { url = new URL(env.TELEGRAM_MINI_APP_URL); } catch { throw new Error("Set a valid TELEGRAM_MINI_APP_URL."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("The Mini App needs an HTTPS URL without credentials, query or fragment.");
  }
  return { token, username, url: url.href };
}

export async function configureTelegramMenu(settings, { apply = false, request = fetch } = {}) {
  async function api(method, body = {}) {
    const form = new URLSearchParams(body).toString();
    let response;
    try {
      response = await request(`https://api.telegram.org/bot${settings.token}/${method}`, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": String(Buffer.byteLength(form)) },
        body: form, signal: AbortSignal.timeout(15000), redirect: "error",
      });
    } catch { throw new Error(`Telegram ${method} request failed. Check connectivity and bot access.`); }
    let data;
    try { data = await response.json(); } catch { throw new Error(`Telegram ${method} returned an invalid response.`); }
    // Never log request URLs, raw API responses or nested fetch errors: they can contain the token.
    if (!response.ok || data.ok !== true) throw new Error(`Telegram ${method} failed. Check the token and bot permissions.`);
    return data.result;
  }

  const bot = await api("getMe");
  if (!bot.is_bot || bot.username?.toLowerCase() !== settings.username.toLowerCase()) {
    throw new Error("Token belongs to a different bot. No settings were changed.");
  }
  const target = { type: "web_app", text: "Open app", web_app: { url: settings.url } };
  const matches = menu => menu?.type === target.type && menu.text === target.text && menu.web_app?.url === settings.url;
  const current = await api("getChatMenuButton");
  const result = { bot: `@${bot.username}`, appUrl: settings.url, mainMiniAppConfigured: bot.has_main_web_app === true };
  if (matches(current)) return { ...result, status: "unchanged" };
  if (!apply) return { ...result, status: "would-update", menu: target };

  let health;
  try {
    const response = await request(new URL("/health/ready", settings.url), { signal: AbortSignal.timeout(15000), redirect: "error" });
    health = response.ok && (await response.json()).status === "ok";
  } catch { health = false; }
  if (!health) throw new Error("Mini App health check failed. No settings were changed; wake the Render service and retry.");
  if (await api("setChatMenuButton", { menu_button: JSON.stringify(target) }) !== true) throw new Error("Telegram did not confirm the menu change.");
  if (!matches(await api("getChatMenuButton"))) throw new Error("Menu change could not be verified. Check the bot in Telegram.");
  return { ...result, status: "updated" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== "--apply")) throw new Error("Usage: node --env-file=deploy/.env.telegram.local scripts/telegram-menu.mjs [--apply]");
    console.log(JSON.stringify(await configureTelegramMenu(telegramSettings(process.env), { apply: args.includes("--apply") }), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
