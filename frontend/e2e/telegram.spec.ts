import { expect, test } from "@playwright/test";

test("only the app pages allow Telegram Web framing", async ({ request }) => {
  for (const path of ["/login", "/projects"]) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-security-policy"]).toBe("frame-ancestors https://web.telegram.org");
    expect(response.headers()["x-frame-options"]).toBeUndefined();
  }
  const health = await request.get("/health/ready");
  expect(health.headers()["content-security-policy"]).toBe("frame-ancestors 'none'");
});

test("Telegram framing policy admits its web client and rejects another origin", async ({ page, request, baseURL }) => {
  // Exercise real production response headers with an inert HTTPS frame probe.
  // This isolates CSP from mixed content, workers and third-party storage rules;
  // actual Telegram-client app behavior is a separate acceptance check.
  await page.route("https://tasktracker.test/**", async route => {
    const target = new URL(route.request().url());
    const response = await request.get(new URL(target.pathname + target.search, baseURL).href);
    const headers = { ...response.headers() };
    delete headers["content-length"]; delete headers["content-encoding"];
    await route.fulfill({ status: response.status(), headers, body: "<!doctype html><h1>Frame probe</h1>" });
  });
  const wrapper = '<iframe title="Mini App" src="https://tasktracker.test/login" style="width:390px;height:800px"></iframe>';
  await page.route("https://web.telegram.org/tasktracker-test", route => route.fulfill({ contentType: "text/html", body: wrapper }));
  await page.goto("https://web.telegram.org/tasktracker-test", { waitUntil: "domcontentloaded" });
  const app = page.frameLocator('iframe[title="Mini App"]');
  await expect(app.getByRole("heading", { name: "Frame probe", exact: true })).toBeVisible();

  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("https://untrusted.example/tasktracker-test", route => route.fulfill({ contentType: "text/html", body: wrapper }));
  await page.goto("https://untrusted.example/tasktracker-test", { waitUntil: "domcontentloaded" });
  await expect.poll(() => errors.some(text => /frame-ancestors|frame ancestor|Content Security Policy/i.test(text))).toBe(true);
});
