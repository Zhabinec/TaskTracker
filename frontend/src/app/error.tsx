"use client";
import { useRouter } from "next/navigation";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const router = useRouter();
  return <main className="workspace"><h1>Сервис временно недоступен</h1>
    <p>Не удалось загрузить данные. Попробуйте ещё раз через несколько секунд.</p>
    <button className="primary" onClick={() => { router.refresh(); reset(); }}>Попробовать снова</button>
  </main>;
}
