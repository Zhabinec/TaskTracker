import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import next from "@next/eslint-plugin-next";
import ts from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  js.configs.recommended,
  ts.configs.recommended,
  next.configs["core-web-vitals"],
  reactHooks.configs.flat.recommended,
  { files: ["public/sw.js"], languageOptions: { globals: { self: "readonly", caches: "readonly", fetch: "readonly", URL: "readonly" } } },
  globalIgnores([".next/**", "coverage/**", "next-env.d.ts"]),
]);
