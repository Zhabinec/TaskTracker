"use client";

import { statusLabels, taskStatuses, validStatus } from "./contracts";
import type { TaskStatus } from "./contracts";
import styles from "./local.module.css";

export function StatusSelect({ id, value, onChange, label, disabled = false }: {
  id?: string; value: TaskStatus; onChange: (status: TaskStatus) => void; label: string; disabled?: boolean;
}) {
  return <select id={id} className={styles.statusSelect} aria-label={label} value={value} disabled={disabled} onChange={event => onChange(validStatus(event.target.value))}>
    {taskStatuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}
  </select>;
}
