import Link from "next/link";
import { LocalEntry } from "@/features/local/entry";
import styles from "./auth.module.css";
import { Icon } from "@/shared/ui/icon";

export function AuthPage() {
  return <main className={styles.shell}>
    <Link className="brand" href="/"><Icon name="brand" className="brand-mark" />TaskTracker</Link>
    <section className={styles.panel} aria-labelledby="form-heading">
      <div className={`glass ${styles.card}`}>
        <div className={styles.welcomeIcon}><Icon name="brand" /></div>
        <h1 id="form-heading">Your space</h1>
        <LocalEntry />
      </div>
    </section>
  </main>;
}
