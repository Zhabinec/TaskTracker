import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TaskTracker — личное пространство", short_name: "TaskTracker",
    description: "Локальные проекты и задачи, доступные без интернета.",
    id: "/", start_url: "/projects", scope: "/", display: "standalone",
    background_color: "#f7f3fb", theme_color: "#f3e8f4", lang: "ru",
    icons: [192, 512].map(size => ({ src: `/icon-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" })),
  };
}
