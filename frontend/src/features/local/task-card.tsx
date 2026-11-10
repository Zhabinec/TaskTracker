import type { Task } from "./contracts";
import { statusLabels } from "./contracts";
import styles from "./local.module.css";

export function TaskCard({ task, disabled, readOnly, onEdit }: { task: Task; disabled: boolean; readOnly: boolean; onEdit: () => void }) {
  return <button type="button" className={styles.taskCard} id={`edit-task-${task.id}`} aria-label={`Edit task: ${task.title}`} aria-haspopup="dialog" disabled={disabled || readOnly} onClick={onEdit}>
    <span className={`${styles.taskTitle} ${task.status === "Done" ? styles.done : ""}`}>{task.title}</span>
    {task.description && <span className={styles.taskDescription}>{task.description}</span>}
    <span className={styles.taskMeta}>
      <span className={styles.statusBadge} data-status={task.status} aria-label={`Status: ${task.title}`}>{statusLabels[task.status]}</span>
      {task.dueDate && <time dateTime={task.dueDate}>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${task.dueDate}T12:00:00`))}</time>}
      {!readOnly && <span className={styles.editHint} aria-hidden="true">Edit ↗</span>}
    </span>
  </button>;
}
