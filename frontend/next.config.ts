import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }, { source: "/build-info.json", headers: [{ key: "Cache-Control", value: "no-store" }] }, { source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }, ...["/login", "/projects"].map(source => ({ source, headers: [
      { key: "Content-Security-Policy", value: "frame-ancestors https://web.telegram.org" },
    ] }))];
  },
};

export default config;
