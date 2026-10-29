"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import styles from "./auth.module.css";

export function AuthForm({ mode, csrf = "", initialError = "" }: {
  mode: "login" | "register" | "logout"; csrf?: string; initialError?: string;
}) {
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);
  const registering = mode === "register";
  const action = `/api/auth/${mode}`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const body = new URLSearchParams();
    for (const [key, value] of fields) if (typeof value === "string") body.append(key, value);
    setError(""); setPending(true);
    try {
      const response = await fetch(action, { method: "POST", body, headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
      const result = await response.json();
      if (!response.ok) {
        setError(typeof result.error === "string" ? result.error : "Не удалось выполнить запрос.");
        setPending(false);
        return;
      }
      if (result.ok !== true) throw new Error("Invalid authentication response");
      // A full navigation drops any prior user's Router Cache after account changes.
      window.location.assign(mode === "logout" ? "/login" : "/projects");
    } catch {
      setError("Не удалось связаться с сервером. Проверьте соединение и попробуйте снова.");
      setPending(false);
    }
  }
  return <form action={action} method="post" onSubmit={submit} className={styles.form} aria-busy={pending}>
    {mode !== "logout" && <>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={pending} />
      <label htmlFor="password">Пароль</label>
      <input id="password" name="password" type="password" autoComplete={registering ? "new-password" : "current-password"}
        minLength={registering ? 15 : 1} maxLength={128} required disabled={pending} aria-describedby={registering ? "password-hint" : undefined} />
      {registering && <p id="password-hint" className={styles.hint}>От 15 до 128 символов. Можно использовать фразу из нескольких слов.</p>}
    </>}
    {mode === "logout" && <input name="csrf_token" type="hidden" value={csrf} />}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <button type="submit" disabled={pending} className={mode === "logout" ? "secondary" : "primary"}>
      {pending ? "Подождите…" : registering ? "Создать аккаунт" : mode === "logout" ? "Выйти" : "Войти"}
    </button>
  </form>;
}
