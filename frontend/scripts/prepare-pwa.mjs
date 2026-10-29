import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

await mkdir("public", { recursive: true });
await writeFile("public/build-info.json", JSON.stringify({ build: randomUUID() }));
const icon = await readFile("public/icon.svg");
for (const size of [192, 512]) await sharp(icon).resize(size, size).png().toFile(`public/icon-${size}.png`);
await mkdir("public/fonts", { recursive: true });
for (const [family, subset, name] of [
  ["plus-jakarta-sans", "latin", "jakarta-latin.woff2"],
  ["inter", "latin", "inter-latin.woff2"],
  ["inter", "cyrillic", "inter-cyrillic.woff2"],
]) await copyFile(`node_modules/@fontsource-variable/${family}/files/${family}-${subset}-wght-normal.woff2`, `public/fonts/${name}`);
for (const family of ["plus-jakarta-sans", "inter"]) await copyFile(`node_modules/@fontsource-variable/${family}/LICENSE`, `public/fonts/${family}-LICENSE.txt`);
