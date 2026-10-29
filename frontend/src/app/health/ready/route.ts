export function GET() {
  return Response.json({ status: "ok", mode: "local" }, { headers: { "Cache-Control": "no-store" } });
}
