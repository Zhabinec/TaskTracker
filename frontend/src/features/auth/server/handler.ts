import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { components } from "@/shared/contracts/api.generated";
import { backendRequest } from "@/shared/server/backend-client";
import { authConfig } from "./config";

class FormError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

async function readForm(request: NextRequest): Promise<URLSearchParams> {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/x-www-form-urlencoded") {
    throw new FormError(415, "invalid_form", "Неверный формат формы.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new FormError(400, "invalid_form", "Форма не заполнена.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel(); }, 5000);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new FormError(413, "body_too_large", "Форма слишком большая.");
      }
      chunks.push(value);
    }
  } finally { clearTimeout(timer); reader.releaseLock(); }
  if (timedOut) throw new FormError(408, "request_timeout", "Сервер не получил форму вовремя.");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const form = new URLSearchParams(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  for (const key of form.keys()) {
    if (!["email", "password", "csrf_token"].includes(key) || form.getAll(key).length !== 1) {
      throw new FormError(400, "invalid_form", "Проверьте заполнение формы.");
    }
  }
  return form;
}

export async function handleAuth(request: NextRequest, mode: "login" | "register" | "logout") {
  let origin: string;
  try { origin = authConfig().origin; }
  catch { return NextResponse.json({ error: "Сервис временно недоступен." }, { status: 503 }); }
  const config = authConfig();
  const result = (status: number, code: string, message?: string) => {
    if (request.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json(message ? { error: message, code } : { ok: true },
        { status, headers: { "Cache-Control": "no-store" } });
    }
    const path = message ? `/${mode === "register" ? "register" : "login"}?error=${encodeURIComponent(code)}` : mode === "logout" ? "/login" : "/projects";
    const response = NextResponse.redirect(new URL(path, origin), 303);
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
  try {
    if (request.headers.get("origin") !== origin) {
      throw new FormError(403, "csrf_rejected", "Запрос отклонён. Обновите страницу.");
    }
    const form = await readForm(request);
    const token = request.cookies.get(config.sessionCookie)?.value;
    const csrf = form.get("csrf_token") ?? "";
    if (mode === "logout") {
      const stored = request.cookies.get(config.csrfCookie)?.value ?? "";
      if (!/^[a-f0-9]{64}$/.test(stored) || !/^[a-f0-9]{64}$/.test(csrf) || !timingSafeEqual(Buffer.from(csrf), Buffer.from(stored))) {
        throw new FormError(403, "csrf_rejected", "Запрос отклонён. Обновите страницу.");
      }
    }
    const response = await backendRequest(`/api/v1/auth/${mode}`, {
      method: "POST", token, csrf: mode === "logout" ? csrf : undefined,
      body: mode === "logout" ? undefined : { email: form.get("email") ?? "", password: form.get("password") ?? "" },
    });
    if (!response.ok && !(mode === "logout" && response.status === 401)) {
      const error: components["schemas"]["ErrorEnvelope"] = await response.json();
      const rejected = result(response.status, error.error.code, error.error.message);
      if (response.status === 429) rejected.headers.set("Retry-After", "60");
      return rejected;
    }
    const outgoing = result(200, "ok");
    const options = { httpOnly: true, secure: config.secure, sameSite: "lax" as const, path: "/" };
    if (mode === "logout") {
      for (const name of [config.sessionCookie, config.csrfCookie]) outgoing.cookies.set(name, "", { ...options, maxAge: 0 });
    } else {
      const session: components["schemas"]["SessionResponse"] = await response.json();
      if (!/^[A-Za-z0-9_-]{43}$/.test(session.session_token) || !/^[a-f0-9]{64}$/.test(session.csrf_token) ||
          !Number.isFinite(Date.parse(session.expires_at))) throw new Error("Invalid backend session");
      const expires = new Date(session.expires_at);
      outgoing.cookies.set(config.sessionCookie, session.session_token, { ...options, expires });
      outgoing.cookies.set(config.csrfCookie, session.csrf_token, { ...options, expires });
    }
    return outgoing;
  } catch (error) {
    if (error instanceof FormError) return result(error.status, error.code, error.message);
    return result(503, "unavailable", "Сервис временно недоступен. Попробуйте ещё раз.");
  }
}
