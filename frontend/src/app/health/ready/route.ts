import { backendGet } from "@/shared/server/backend-client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await backendGet("/health/ready");
    if (response.ok) {
      return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
    }
  } catch {
    // Health responses expose neither configuration nor upstream error details.
  }
  return Response.json({ status: "unavailable" }, {
    status: 503,
    headers: { "Cache-Control": "no-store", "Retry-After": "30" },
  });
}
