import "server-only";

export function authConfig() {
  // Render supplies its canonical HTTPS URL; never trust a request Host header.
  // APP_ORIGIN remains authoritative for custom domains and self-hosting.
  const configured = process.env.APP_ORIGIN ?? (process.env.RENDER === "true" ? process.env.RENDER_EXTERNAL_URL : undefined);
  if (!configured && process.env.NODE_ENV === "production") throw new Error("APP_ORIGIN is required");
  const origin = configured ?? "http://localhost:3000";
  const url = new URL(origin);
  if (url.origin !== origin || !["https:", "http:"].includes(url.protocol)) {
    throw new Error("APP_ORIGIN must be an exact HTTP(S) origin");
  }
  const secure = url.protocol === "https:";
  if (!secure && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Public origins require HTTPS");
  }
  return {
    origin, secure,
    sessionCookie: secure ? "__Host-tasktracker_session" : "tasktracker_session",
    csrfCookie: secure ? "__Host-tasktracker_csrf" : "tasktracker_csrf",
  };
}
