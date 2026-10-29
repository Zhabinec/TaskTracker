import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { backendGet } from "../src/shared/server/backend-client";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("server backend boundary", () => {
  it("fails closed without an upstream configuration", async () => {
    vi.stubEnv("FASTAPI_INTERNAL_URL", "");
    await expect(backendGet("/health/live")).rejects.toThrow("required");
  });

  it("rejects credentials and external plaintext production upstreams", async () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const value of ["https://user:password@example.com", "http://example.com"]) {
      vi.stubEnv("FASTAPI_INTERNAL_URL", value);
      await expect(backendGet("/health/live")).rejects.toThrow();
    }
  });

  it("disables shared caching and redirects and bounds request time", async () => {
    vi.stubEnv("FASTAPI_INTERNAL_URL", "http://127.0.0.1:8000");
    const request = vi.fn().mockResolvedValue(new Response('{"status":"ok"}'));
    vi.stubGlobal("fetch", request);
    await backendGet("/health/live");
    expect(request).toHaveBeenCalledWith(new URL("http://127.0.0.1:8000/health/live"),
      expect.objectContaining({ cache: "no-store", redirect: "error", signal: expect.any(AbortSignal) }));
  });
});
