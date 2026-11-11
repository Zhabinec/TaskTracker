import { cp, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const root = process.cwd();
const staging = resolve(root, ".cache/static-site");
const source = join(root, "src");
const serverRoutes = new Set(["app/api", "app/health"]);

function run(script, args, cwd) {
  const result = spawnSync(process.execPath, [join(root, script), ...args], { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} exited with status ${result.status}`);
}

await mkdir(staging, { recursive: true });
// Use a fresh source tree so renamed or removed routes cannot survive a rebuild.
const project = await mkdtemp(join(staging, "build-"));
try {
  await cp(source, join(project, "src"), {
    recursive: true,
    filter: path => !serverRoutes.has(relative(source, path).split(sep).join("/")),
  });
  for (const file of ["package.json", "tsconfig.json"]) await cp(join(root, file), join(project, file));
  const publicDir = join(project, "public");
  await cp(join(root, "public"), publicDir, { recursive: true });
  run("scripts/prepare-pwa.mjs", [publicDir], root);
  await writeFile(join(project, "next.config.mjs"), "export default { output: 'export' };\n");
  run("node_modules/next/dist/bin/next", ["build"], project);
  const output = join(project, "out");
  await mkdir(join(output, "health"));
  await writeFile(join(output, "health/ready.json"), JSON.stringify({ status: "ok", mode: "static" }));
  const publish = join(staging, "out");
  await rm(publish, { recursive: true, force: true });
  await rename(output, publish);
} finally {
  await rm(project, { recursive: true, force: true });
}
