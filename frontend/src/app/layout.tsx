import type { Metadata, Viewport } from "next";
import { AmbientBackdrop } from "@/shared/ui/ambient-backdrop";
import { OfflineRuntime } from "@/shared/ui/offline-runtime";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskTracker",
  description: "Рабочее пространство для проектов и задач",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "TaskTracker" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f3e8f4" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body><AmbientBackdrop />{children}<OfflineRuntime /></body></html>;
}
