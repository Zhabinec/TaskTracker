import { requireUser, sessionCsrf } from "@/features/auth/server/session";
import { AuthForm } from "@/features/auth/ui/auth-form";

export default async function Projects() {
  const user = await requireUser();
  const csrf = await sessionCsrf();
  return <main className="workspace">
    <header className="workspace-header"><span className="brand">TaskTracker<span aria-hidden="true"> /</span></span>
      <div className="account"><span>{user.email}</span><AuthForm mode="logout" csrf={csrf} /></div>
    </header>
    <section className="workspace-body" aria-labelledby="projects-title">
      <p className="eyebrow">Ваше рабочее пространство</p><h1 id="projects-title">Проекты</h1>
      <div className="empty-state"><span aria-hidden="true" className="empty-icon">↗</span>
        <h2>Вы вошли в аккаунт</h2>
        <p className="muted">Сессия сохранится после обновления страницы. Следующим этапом здесь появятся создание проектов и задачи.</p>
      </div>
    </section>
  </main>;
}
