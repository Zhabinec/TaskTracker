import Link from "next/link";
import { LocalEntry } from "@/features/local/entry";
import styles from "./auth.module.css";

export function AuthPage() {
  return <main className={styles.shell}>
    <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">✳</span> TaskTracker</Link>
    <section className={styles.panel} aria-labelledby="form-heading">
      <div className={`glass ${styles.card}`}>
        <div className={styles.welcomeIcon} aria-hidden="true">✦</div>
        <h1 id="form-heading">Your space</h1>
        <LocalEntry />
      </div>
    </section>
  </main>;
}
