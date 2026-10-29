import "server-only";

// Extend this allowlist as API scenarios are implemented.
type BackendEndpoint = "/health/live" | "/health/ready";

function backendBaseUrl(): string {
  const value = process.env.FASTAPI_INTERNAL_URL;
  if (!value) throw new Error("FASTAPI_INTERNAL_URL is required");
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.pathname !== "/") {
    throw new Error("FASTAPI_INTERNAL_URL must be an HTTP(S) origin without credentials");
  }
  if (process.env.NODE_ENV === "production" && url.protocol === "http:" &&
      !["api", "localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("External backend connections require HTTPS");
  }
  return url.origin;
}

export async function backendGet(endpoint: BackendEndpoint): Promise<Response> {
  return fetch(new URL(endpoint, backendBaseUrl()), {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(5000),
    headers: { Accept: "application/json" },
  });
}
