"use client";

import { useEffect, useState } from "react";
import type { DueFilter, Task, TaskStatus } from "./contracts";
import { localToday } from "./contracts";
import { queryTasks } from "./store";
import type { TaskCursor } from "./store";

export function useTaskQuery(projectId: string, status: TaskStatus | "all", search: string, due: DueFilter, revision: number) {
  const [query, setQuery] = useState(search);
  useEffect(() => { const timeout = setTimeout(() => setQuery(search), 250); return () => clearTimeout(timeout); }, [search]);
  const [page, setPage] = useState<{ key: string; items: Task[]; more: boolean; cursor?: TaskCursor; loadingMore?: boolean; error?: string }>({ key: "", items: [], more: false });
  const [retry, setRetry] = useState(0);
  const [today, setToday] = useState(localToday);
  useEffect(() => { const timer = setInterval(() => setToday(localToday()), 30000); return () => clearInterval(timer); }, []);
  const key = JSON.stringify([projectId, status, query, due, revision, retry, today]);
  useEffect(() => {
    if (!projectId) return;
    let active = true;
    queryTasks(projectId, status, query, due).then(result => { if (active) setPage({ key, ...result }); }).catch(cause => { if (active) setPage({ key, items: [], more: false, error: cause instanceof Error ? cause.message : "Tasks unavailable." }); });
    return () => { active = false; };
  }, [key, projectId, status, query, due]);
  async function more() {
    if (!page.more || !page.cursor || page.loadingMore || page.key !== key) return;
    setPage(current => ({ ...current, loadingMore: true }));
    try {
      const next = await queryTasks(projectId, status, query, due, page.cursor);
      setPage(current => current.key === key ? { key, items: [...current.items, ...next.items.filter(item => !current.items.some(value => value.id === item.id))], more: next.more, cursor: next.cursor } : current);
    } catch (cause) { setPage(current => current.key === key ? { ...current, loadingMore: false, error: cause instanceof Error ? cause.message : "Could not load tasks." } : current); }
  }
  return { ...page, ready: page.key === key, moreTasks: more, retry: () => setRetry(count => count + 1) };
}
