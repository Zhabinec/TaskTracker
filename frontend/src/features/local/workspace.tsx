"use client";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { LocalProfile, Project, Task, TaskStatus } from "./contracts";
import { changeTask, createProject, createTask, listProjects, listTasks, profile, subscribeChanges } from "./store";
import styles from "./local.module.css";

const labels: Record<TaskStatus, string> = { Todo: "К выполнению", InProgress: "В работе", Done: "Готово" };
function friendlyError(cause: unknown) { return cause instanceof Error ? cause.message : "Не удалось выполнить действие. Попробуйте ещё раз."; }

export function LocalWorkspace() {
  const [owner, setOwner] = useState<LocalProfile>(); const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState(""); const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [projectLimit, setProjectLimit] = useState(50); const [taskLimit, setTaskLimit] = useState(50);
  const [moreProjects, setMoreProjects] = useState(false); const [revision, setRevision] = useState(0);
  const [taskPage, setTaskPage] = useState<{ key: string; items: Task[]; more: boolean }>({ key: "", items: [], more: false });
  const [projectName, setProjectName] = useState(""); const [title, setTitle] = useState(""); const [dueDate, setDueDate] = useState("");
  const [working, setWorking] = useState(false); const [error, setError] = useState("");
  const key = `${selected}:${filter}:${taskLimit}:${revision}`;
  useEffect(() => subscribeChanges(() => setRevision(value => value + 1)), []);
  useEffect(() => {
    let active = true;
    Promise.all([profile(), listProjects(projectLimit)]).then(([value, page]) => {
      if (!active) return;
      if (!value) { window.location.replace("/login"); return; }
      setOwner(value); setProjects(page.items); setMoreProjects(page.more);
      setSelected(current => page.items.some(item => item.id === current) ? current : page.items[0]?.id ?? "");
    }).catch(cause => { if (active) setError(friendlyError(cause)); });
    return () => { active = false; };
  }, [revision, projectLimit]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    listTasks(selected, filter, taskLimit).then(page => { if (active) setTaskPage({ key, ...page }); })
      .catch(cause => { if (active) setError(friendlyError(cause)); });
    return () => { active = false; };
  }, [selected, filter, taskLimit, key]);
  async function run(action: () => Promise<void>) {
    if (working) return; setWorking(true); setError("");
    try { await action(); }
    catch (cause) { setError(friendlyError(cause)); setRevision(value => value + 1); }
    finally { setWorking(false); }
  }
  function addProject(event: FormEvent) {
    event.preventDefault(); void run(async () => { const value = await createProject(projectName); setProjectName(""); setSelected(value.id); setFilter("all"); setTaskLimit(50); });
  }
  function addTask(event: FormEvent) {
    event.preventDefault(); void run(async () => { await createTask(selected, title, dueDate); setTitle(""); setDueDate(""); setFilter("all"); });
  }
  if (!owner) return <main className={styles.shell}><a className="brand" href="/login"><span className="brand-mark" aria-hidden="true">✳</span> TaskTracker</a>
    <div className={`glass ${styles.empty}`} role="status">{error || "Открываем локальное пространство…"}</div></main>;
  const project = projects.find(value => value.id === selected);
  const total = project?.taskCount ?? 0; const done = project?.doneCount ?? 0; const percent = total ? Math.round(done / total * 100) : 0;
  const tasksReady = taskPage.key === key;
  const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", weekday: "long" }).format(new Date());
  return <main className={styles.shell}>
    <header className={styles.header}><a className="brand" href="/projects"><span className="brand-mark" aria-hidden="true">✳</span> TaskTracker</a>
      <div className={styles.headerRight}><span className={styles.deviceBadge}>◈ На этом устройстве</span>
        <a className={styles.profile} href="/login" aria-label="Настроить локальное пространство"><span className={styles.avatar}>{owner.name.slice(0, 1).toUpperCase()}</span><span>{owner.name}</span></a>
      </div></header>
    <div className={styles.heading}><div><span className="eyebrow">Пространство для важного</span><h1>Хороший день для новых идей.</h1><p>Один шаг, одна задача — и вы уже ближе к цели.</p></div><span className={styles.date}>{date}</span></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className={styles.layout}>
      <aside className={`glass ${styles.sidebar}`} aria-label="Проекты"><div className={styles.sectionLabel}><h2>Мои проекты</h2><span>{projects.length}{moreProjects ? "+" : ""}</span></div>
        <div className={styles.projectList}>{projects.map(value => <button key={value.id} className={styles.project} aria-pressed={selected === value.id} onClick={() => { setSelected(value.id); setTaskLimit(50); setFilter("all"); }}>
          <span className={styles.dot} data-color={value.color} aria-hidden="true" /><span className={styles.projectName}>{value.name}</span><span className={styles.projectCount}>{value.taskCount}</span>
        </button>)}</div>
        {moreProjects && <button className={`secondary ${styles.loadMore}`} onClick={() => setProjectLimit(value => value + 50)}>Ещё проекты</button>}
        <form className={styles.inlineForm} onSubmit={addProject}><label htmlFor="project-name">Новый проект</label><input id="project-name" placeholder="Название проекта" value={projectName} onChange={event => setProjectName(event.target.value)} maxLength={100} required disabled={working} /><button className="secondary" disabled={working} type="submit">＋ Создать проект</button></form>
      </aside>
      <section className={`glass ${styles.board}`} aria-labelledby="board-title">
        <div className={styles.boardHeading}><div><h2 id="board-title">{project?.name ?? "Ваш следующий большой шаг"}</h2><p>{project ? "Планы становятся результатами, задача за задачей." : "Начните с проекта, который важен именно вам."}</p></div>{project && <span className={styles.countBadge}>{total}</span>}</div>
        {project ? <>
          <div className={styles.tabs} aria-label="Фильтр задач">{(["all", "Todo", "InProgress", "Done"] as const).map(status => <button key={status} aria-pressed={filter === status} onClick={() => { setFilter(status); setTaskLimit(50); }}>{status === "all" ? "Все задачи" : labels[status]}</button>)}</div>
          {!tasksReady ? <p role="status" className={styles.empty}>Загружаем задачи…</p> : taskPage.items.length ? <ul className={styles.taskList}>{taskPage.items.map(task => <li key={task.id} className={styles.task}>
            <button className={styles.taskStatus} data-status={task.status} aria-label={`${task.status === "Todo" ? "Начать" : task.status === "InProgress" ? "Завершить" : "Вернуть"}: ${task.title}`} disabled={working}
              onClick={() => void run(() => changeTask(task, task.status === "Todo" ? "InProgress" : task.status === "InProgress" ? "Done" : "Todo"))}>{task.status === "Done" ? "✓" : task.status === "InProgress" ? "•" : ""}</button>
            <div className={styles.taskContent}><p className={`${styles.taskTitle} ${task.status === "Done" ? styles.done : ""}`}>{task.title}</p><div className={styles.taskMeta}><span>{labels[task.status]}</span>{task.dueDate && <time dateTime={task.dueDate}>{new Intl.DateTimeFormat("ru", { day: "numeric", month: "short" }).format(new Date(`${task.dueDate}T12:00:00`))}</time>}</div></div>
            <button className={styles.delete} disabled={working} aria-label={`Удалить задачу: ${task.title}`} onClick={() => void run(() => changeTask(task, "delete"))}>×</button>
          </li>)}</ul> : <div className={styles.empty}><span className={styles.emptyIcon} aria-hidden="true">✧</span><strong>{filter === "all" ? "Здесь начинается прогресс" : "Пока без задач"}</strong><p>{filter === "all" ? "Добавьте первую задачу — большую идею проще воплотить небольшими шагами." : "Задачи с этим статусом появятся здесь."}</p></div>}
          {tasksReady && taskPage.more && <button className={`secondary ${styles.loadMore}`} onClick={() => setTaskLimit(value => value + 50)}>Показать ещё задачи</button>}
          <form className={styles.taskForm} onSubmit={addTask}><label htmlFor="task-title">Следующий шаг</label><input id="task-title" placeholder="Что нужно сделать?" maxLength={200} value={title} onChange={event => setTitle(event.target.value)} required disabled={working} />
            <div className={styles.taskFormBottom}><label htmlFor="task-due">Дедлайн</label><input id="task-due" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} disabled={working} /><button className="primary" disabled={working} type="submit">＋ Добавить задачу</button></div></form>
        </> : <div className={styles.empty}><span className={styles.emptyIcon} aria-hidden="true">✳</span><strong>Освободите место для идей</strong><p>Создайте первый проект в панели слева. Всё сохранится на вашем устройстве и будет доступно без сети.</p></div>}
      </section>
      <aside className={styles.right}><section className={`glass ${styles.summary}`} aria-labelledby="progress-title"><h2 id="progress-title">Маленькие победы</h2>
        <div className={styles.ring} style={{ background: `conic-gradient(#b68ad4 ${percent}%, #e9dcf27a 0)` }}><strong>{percent}%</strong></div><p className={styles.progressText}>{done} из {total} задач завершено</p>
        <div className={styles.statRow}><span>Всего задач</span><strong>{total}</strong></div><div className={styles.statRow}><span>Завершено</span><strong>{done}</strong></div><div className={styles.statRow}><span>Впереди</span><strong>{total - done}</strong></div>
      </section><div className={`glass ${styles.deviceNote}`}><strong>◈ Ваше личное пространство</strong>Проекты остаются в этом браузере. Подключение к сети для работы с задачами не требуется.</div></aside>
    </div><p className={styles.footer}>Сделано для спокойной, сосредоточенной работы.</p>
  </main>;
}
