"use client";
import { useRouter } from "next/navigation";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const router = useRouter();
  return <main className="workspace"><h1>Temporarily unavailable</h1>
    <p>Could not load your data. Please retry.</p>
    <button className="primary" onClick={() => { router.refresh(); reset(); }}>Try again</button>
  </main>;
}
