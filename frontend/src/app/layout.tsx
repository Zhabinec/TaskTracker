import type { Metadata, Viewport } from "next";
import { DraftSafety } from "@/features/local/draft-safety";
import { AmbientBackdrop } from "@/shared/ui/ambient-backdrop";
import { OfflineRuntime } from "@/shared/ui/offline-runtime";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskTracker",
  description: "A quiet space for projects and tasks",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "TaskTracker" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f3e8f4" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><head>
    <link rel="preload" href="/fonts/jakarta-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
    <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
  </head><body><AmbientBackdrop />{children}<DraftSafety /><OfflineRuntime /></body></html>;
}
