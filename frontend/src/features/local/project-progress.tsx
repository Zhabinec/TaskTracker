import type { CSSProperties } from "react";
import styles from "./local.module.css";

export function ProjectProgress({ total, done, compact = false }: { total: number; done: number; compact?: boolean }) {
  const percent = total ? Math.round(done / total * 100) : 0;
  if (compact) return <div className={styles.compactProgress}>
    <progress aria-label="Project completion" value={done} max={total || 1} />
    <span>{done} / {total} done · {percent}%</span>
  </div>;
  return <section className={`glass ${styles.summary}`} aria-labelledby="progress-title"><h2 id="progress-title">Progress</h2>
    <div className={styles.ring} style={{ "--task-completion": `${percent}%` } as CSSProperties} aria-hidden="true"><strong>{percent}%</strong></div>
    <p className={styles.progressText} aria-label={`${done} of ${total} tasks completed`}>{done} / {total}</p>
  </section>;
}
