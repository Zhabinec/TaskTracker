import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { components } from "@/shared/contracts/api.generated";
import { backendRequest } from "@/shared/server/backend-client";
import { authConfig } from "./config";

export async function currentUser(): Promise<components["schemas"]["ProfileResponse"] | null> {
  const store = await cookies();
  const config = authConfig();
  const token = store.get(config.sessionCookie)?.value;
  if (!token || !store.get(config.csrfCookie)?.value) return null;
  const response = await backendRequest("/api/v1/auth/me", { token });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Backend unavailable");
  return response.json();
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function sessionCsrf() {
  return (await cookies()).get(authConfig().csrfCookie)?.value ?? "";
}
