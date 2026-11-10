import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { authConfig } from "../src/features/auth/server/config";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ORIGIN", undefined);
  vi.stubEnv("RENDER", undefined);
  vi.stubEnv("RENDER_EXTERNAL_URL", undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("deployment origin boundary", () => {
  it("uses the Render origin with secure host cookies", () => {
    vi.stubEnv("RENDER", "true");
    vi.stubEnv("RENDER_EXTERNAL_URL", "https://tasktracker.onrender.com");
    expect(authConfig()).toMatchObject({
      origin: "https://tasktracker.onrender.com", secure: true,
      sessionCookie: "__Host-tasktracker_session", csrfCookie: "__Host-tasktracker_csrf",
    });
  });

  it("keeps the explicit custom origin authoritative", () => {
    vi.stubEnv("RENDER", "true");
    vi.stubEnv("RENDER_EXTERNAL_URL", "https://tasktracker.onrender.com");
    vi.stubEnv("APP_ORIGIN", "https://tasks.example.com");
    expect(authConfig().origin).toBe("https://tasks.example.com");
  });

  it("does not use a platform URL outside Render or default production to localhost", () => {
    vi.stubEnv("RENDER_EXTERNAL_URL", "https://tasktracker.onrender.com");
    expect(() => authConfig()).toThrow("APP_ORIGIN is required");
    vi.stubEnv("RENDER", "true");
    vi.stubEnv("RENDER_EXTERNAL_URL", undefined);
    expect(() => authConfig()).toThrow("APP_ORIGIN is required");
  });

  it.each([
    "http://tasktracker.onrender.com", "https://user:password@tasktracker.onrender.com",
    "https://tasktracker.onrender.com/path", "https://tasktracker.onrender.com/",
  ])("rejects unsafe or inexact Render origins: %s", origin => {
    vi.stubEnv("RENDER", "true");
    vi.stubEnv("RENDER_EXTERNAL_URL", origin);
    expect(() => authConfig()).toThrow();
  });
});
