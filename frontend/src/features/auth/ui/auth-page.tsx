import Link from "next/link";
import { AuthForm } from "./auth-form";
import styles from "./auth.module.css";

export function AuthPage({ register = false, error = false }: { register?: boolean; error?: boolean }) {
  return <main className={styles.shell}>
    <aside className={styles.story}>
      <Link className="brand" href="/">TaskTracker<span aria-hidden="true"> /</span></Link>
      <div><p className="eyebrow">От замысла к результату</p>
        <h1>Меньше держать <br />в голове. <br />Больше делать.</h1>
        <p className={styles.copy}>Ваши проекты, задачи и сроки — в одном рабочем пространстве.</p></div>
      <p className={styles.footer}>Личное пространство. Понятные приоритеты.</p>
    </aside>
    <section className={styles.panel} aria-labelledby="form-heading">
      <div className={styles.card}>
        <p className="eyebrow">{register ? "Начнём с главного" : "С возвращением"}</p>
        <h2 id="form-heading">{register ? "Создать аккаунт" : "Войти в TaskTracker"}</h2>
        <p className="muted">{register ? "Укажите email и придумайте надёжный пароль." : "Продолжите с того места, где остановились."}</p>
        <AuthForm mode={register ? "register" : "login"} initialError={error ? "Не удалось выполнить запрос. Проверьте данные и попробуйте снова." : ""} />
        <p className={styles.switch}>{register ? "Уже есть аккаунт?" : "Первый раз здесь?"} <Link href={register ? "/login" : "/register"}>{register ? "Войти" : "Создать аккаунт"}</Link></p>
      </div>
    </section>
  </main>;
}
