import Link from "next/link";
import { LocalEntry } from "@/features/local/entry";
import styles from "./auth.module.css";

export function AuthPage() {
  return <main className={styles.shell}>
    <aside className={styles.story}>
      <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">✳</span> TaskTracker</Link>
      <div className={styles.intro}><p className="eyebrow">Место, где идеи обретают форму</p>
        <h1>Ваши планы.<br />В лёгком <em>ритме.</em></h1>
        <p className={styles.copy}>Соберите важное в одном месте.<br />И двигайтесь вперёд — в своём темпе.</p>
        <div className={styles.preview} aria-hidden="true"><div className={styles.calendar}><span>ВАШ СЛЕДУЮЩИЙ ШАГ</span><strong>Сегодня</strong><div className={styles.week}>{["П","В","С","Ч","П","С","В"].map((day, index) => <span key={index} data-active={index === 3}>{day}<b>{12 + index}</b></span>)}</div><div className={styles.previewTask}><i>✓</i><div><strong>Освободить место для идей</strong><small>Всё начинается с одного шага</small></div></div></div><div className={styles.floating}><span>✧</span><div><strong>Меньше шума.</strong><small>Больше ясности.</small></div></div></div>
      </div>
      <p className={styles.footer}><span>◈</span> Без регистрации. Даже без интернета.</p>
    </aside>
    <section className={styles.panel} aria-labelledby="form-heading">
      <div className={`glass ${styles.card}`}>
        <div className={styles.welcomeIcon} aria-hidden="true">✦</div><p className="eyebrow">Всё начинается с вас</p>
        <h2 id="form-heading">Моё пространство</h2>
        <p className="muted">Немного порядка. Много возможностей.</p>
        <LocalEntry />
      </div>
    </section>
  </main>;
}
