import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

await mkdir("public", { recursive: true });
await writeFile("public/build-info.json", JSON.stringify({ build: randomUUID() }));
const icon = await readFile("public/icon.svg");
for (const size of [192, 512]) await sharp(icon).resize(size, size).png().toFile(`public/icon-${size}.png`);
