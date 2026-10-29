import { redirect } from "next/navigation";
import { currentUser } from "@/features/auth/server/session";
import { AuthPage } from "@/features/auth/ui/auth-page";

export default async function Register({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentUser()) redirect("/projects");
  return <AuthPage register error={Boolean((await searchParams).error)} />;
}
