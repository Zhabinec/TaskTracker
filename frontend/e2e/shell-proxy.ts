import http from "node:http";

// Loopback faults reach real service-worker fetches in every browser engine.
export async function shellProxy(upstream: string, failure: "once" | "hold" | "persistent") {
  let requests = 0;
  let released = false; let resolveHeld!: () => void;
  const held = new Promise<void>(resolve => { resolveHeld = resolve; });
  const release = () => { released = true; resolveHeld(); };
  const sockets = new Set<import("node:net").Socket>();
  const server = http.createServer(async (request, response) => {
    if (request.url === "/fonts/inter-cyrillic.woff2") {
      requests += 1;
      if ((requests === 1 && failure === "once") || (failure === "persistent" && !released)) { response.writeHead(503, { "Cache-Control": "no-store" }); response.end("Temporary asset failure"); return; }
      if (requests === 1 && failure === "hold") await held;
    }
    const outgoing = http.request(new URL(request.url!, upstream), { method: request.method, headers: { ...request.headers, host: new URL(upstream).host } }, incoming => {
      response.writeHead(incoming.statusCode!, incoming.headers); incoming.pipe(response);
    });
    outgoing.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end(); });
    request.pipe(outgoing);
  });
  server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address() as import("node:net").AddressInfo;
  return {
    origin: `http://127.0.0.1:${address.port}`,
    requests: () => requests,
    release,
    async close() { release(); for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); },
  };
}
