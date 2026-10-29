import type { NextRequest } from "next/server";
import { handleAuth } from "@/features/auth/server/handler";

export const runtime = "nodejs";
export function POST(request: NextRequest) { return handleAuth(request, "register"); }
