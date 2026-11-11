import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import sharp from "sharp";

const publicDir = process.argv[2] ?? "public";
const fontsDir = join(publicDir, "fonts");
await mkdir(fontsDir, { recursive: true });
await writeFile(join(publicDir, "build-info.json"), JSON.stringify({ build: randomUUID() }));
const icon = await readFile(join(publicDir, "icon.svg"));
for (const size of [192, 512]) await sharp(icon).resize(size, size).png().toFile(join(publicDir, `icon-${size}.png`));
for (const [family, subset, name] of [
  ["plus-jakarta-sans", "latin", "jakarta-latin.woff2"],
  ["inter", "latin", "inter-latin.woff2"],
  ["inter", "cyrillic", "inter-cyrillic.woff2"],
]) await copyFile(`node_modules/@fontsource-variable/${family}/files/${family}-${subset}-wght-normal.woff2`, join(fontsDir, name));
for (const family of ["plus-jakarta-sans", "inter"]) await copyFile(`node_modules/@fontsource-variable/${family}/LICENSE`, join(fontsDir, `${family}-LICENSE.txt`));
