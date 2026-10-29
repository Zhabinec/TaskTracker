import "server-only";
import type { components, paths } from "@/shared/contracts/api.generated";

type BackendEndpoint = keyof paths;

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
  return backendRequest(endpoint);
}

export async function backendRequest(endpoint: BackendEndpoint, options: {
  method?: "GET" | "POST";
  body?: components["schemas"]["Credentials"];
  token?: string;
  csrf?: string;
} = {}): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.csrf) headers["X-CSRF-Token"] = options.csrf;
  return fetch(new URL(endpoint, backendBaseUrl()), {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(5000),
    method: options.method ?? "GET",
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers,
  });
}
