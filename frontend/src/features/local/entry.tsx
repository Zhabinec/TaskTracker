"use client";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { profile, saveProfile } from "./store";
import styles from "./local.module.css";

export function LocalEntry() {
  const [name, setName] = useState(""); const [existing, setExisting] = useState(false);
  const [ready, setReady] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  useEffect(() => { let active = true; profile().then(value => { if (active) { setName(value?.name ?? ""); setExisting(Boolean(value)); setReady(true); } }).catch(() => { if (active) { setError("Не удалось открыть локальное хранилище. Разрешите сохранение данных для сайта."); setReady(true); } }); return () => { active = false; }; }, []);
  async function open(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return; setPending(true); setError("");
    try { await saveProfile(name); window.location.assign("/projects"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось сохранить пространство."); setPending(false); }
  }
  return <form onSubmit={open} className={styles.entryForm} aria-busy={pending || !ready}>
    <label htmlFor="display-name">Название</label>
    <input id="display-name" name="name" aria-label="Название пространства" placeholder="Моё пространство" value={name} onChange={event => setName(event.target.value)} maxLength={60} autoComplete="off" disabled={pending || !ready} />
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="primary" disabled={pending || !ready} type="submit">{pending ? "Открываем…" : !ready ? "Подготовка…" : existing ? "Продолжить ↗" : "Начать ↗"}</button>
    <details className={styles.finePrint}><summary>Данные — в этом браузере</summary><p>Очистка данных сайта удалит проекты. Для работы без сети дождитесь готовности офлайн-режима.</p></details>
  </form>;
}
