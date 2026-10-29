import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TaskTracker — your workspace", short_name: "TaskTracker",
    description: "Projects and tasks, online or offline.",
    id: "/", start_url: "/projects", scope: "/", display: "standalone",
    background_color: "#f7f3fb", theme_color: "#f3e8f4", lang: "en",
    icons: [192, 512].map(size => ({ src: `/icon-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" })),
  };
}
