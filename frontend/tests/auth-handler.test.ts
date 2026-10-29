import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("../src/shared/server/backend-client", () => ({ backendRequest: vi.fn() }));
import { backendRequest } from "../src/shared/server/backend-client";
import { handleAuth } from "../src/features/auth/server/handler";

const upstream = vi.mocked(backendRequest);
const token = "a".repeat(43);
const csrf = "b".repeat(64);

function request(body = new URLSearchParams({ email: "test@example.com", password: "a long password for tests" }), headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST", body: body.toString(),
    headers: { Origin: "http://localhost:3000", Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", ...headers },
  });
}

beforeEach(() => { vi.stubEnv("APP_ORIGIN", "http://localhost:3000"); upstream.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("browser authentication boundary", () => {
  it("returns no credential JSON and places credentials only in HttpOnly cookies", async () => {
    upstream.mockResolvedValue(Response.json({ session_token: token, csrf_token: csrf, expires_at: new Date(Date.now() + 3600000).toISOString() }));
    const response = await handleAuth(request(), "login");
    expect(await response.json()).toEqual({ ok: true });
    expect(response.cookies.get("tasktracker_session")?.value).toBe(token);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(response.headers.get("set-cookie")).not.toContain("Domain=");
  });

  it("rejects foreign origins before contacting the backend", async () => {
    const response = await handleAuth(request(undefined, { Origin: "https://evil.example" }), "login");
    expect(response.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("bounds body size and rejects ambiguous duplicate fields", async () => {
    const oversized = await handleAuth(request(new URLSearchParams({ password: "a".repeat(9000) })), "login");
    expect(oversized.status).toBe(413);
    const duplicate = await handleAuth(request(new URLSearchParams("email=a&email=b")), "login");
    expect(duplicate.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects forged or non-ASCII CSRF without contacting the backend", async () => {
    for (const value of ["wrong", "я".repeat(64)]) {
      const response = await handleAuth(request(new URLSearchParams({ csrf_token: value }), { Cookie: `tasktracker_session=${token}; tasktracker_csrf=${csrf}` }), "logout");
      expect(response.status).toBe(403);
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it("retains cookies when revocation fails and deletes them after a successful retry", async () => {
    const form = new URLSearchParams({ csrf_token: csrf });
    const headers = { Cookie: `tasktracker_session=${token}; tasktracker_csrf=${csrf}` };
    upstream.mockRejectedValueOnce(new Error("connection lost"));
    const failed = await handleAuth(request(form, headers), "logout");
    expect(failed.status).toBe(503);
    expect(failed.headers.get("set-cookie")).toBeNull();
    upstream.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const success = await handleAuth(request(form, headers), "logout");
    expect(success.status).toBe(200);
    expect(upstream).toHaveBeenLastCalledWith("/api/v1/auth/logout", expect.objectContaining({ token, csrf }));
    expect(success.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("uses Secure host cookies for a public HTTPS origin", async () => {
    vi.stubEnv("APP_ORIGIN", "https://tasks.example.com");
    upstream.mockResolvedValue(Response.json({ session_token: token, csrf_token: csrf, expires_at: new Date(Date.now() + 3600000).toISOString() }));
    const response = await handleAuth(request(undefined, { Origin: "https://tasks.example.com" }), "register");
    expect(response.cookies.get("__Host-tasktracker_session")?.value).toBe(token);
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("Path=/");
  });

  it("supports native HTML forms with a 303 redirect", async () => {
    upstream.mockResolvedValue(Response.json({ session_token: token, csrf_token: csrf, expires_at: new Date(Date.now() + 3600000).toISOString() }));
    const response = await handleAuth(request(undefined, { Accept: "text/html" }), "login");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/projects");
  });
});
