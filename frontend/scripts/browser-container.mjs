// Keep localhost a secure context for service workers inside the browser container.
import net from "node:net";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

const sockets = new Set();
const server = net.createServer(client => {
  const upstream = net.connect(3000, "frontend"); sockets.add(client); sockets.add(upstream);
  client.pipe(upstream); upstream.pipe(client);
  client.on("error", () => upstream.destroy()); upstream.on("error", () => client.destroy());
  client.on("close", () => { sockets.delete(client); upstream.destroy(); }); upstream.on("close", () => sockets.delete(upstream));
});
server.listen(3000, "127.0.0.1", () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url)), "test", ...process.argv.slice(2)], {
    stdio: "inherit", env: { ...process.env, E2E_BASE_URL: "http://localhost:3000" },
  });
  child.on("exit", code => { for (const socket of sockets) socket.destroy(); server.close(() => process.exit(code ?? 1)); });
  child.on("error", error => { process.stderr.write(`${error.message}\n`); server.close(() => process.exit(1)); });
});
