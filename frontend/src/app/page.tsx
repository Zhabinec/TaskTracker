export default function Home() {
  return (
    <main>
      <div className="brand">TaskTracker<span aria-hidden="true"> /</span></div>
      <section aria-labelledby="title">
        <p className="eyebrow">Проекты · Задачи · Результат</p>
        <h1 id="title">Каждой задаче —<br />своё место.</h1>
        <p className="description">Единое рабочее пространство для ваших проектов, приоритетов и сроков.</p>
        <p className="notice">Сервис готовится к запуску. Регистрация откроется позже.</p>
      </section>
      <footer>TaskTracker · Ваш следующий шаг под контролем</footer>
    </main>
  );
}
