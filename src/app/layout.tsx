import type { Metadata, Viewport } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/newsreader";
import "./globals.css";
import "./session.css";
import "./figma-design.css";
import "./figma-hero.css";

export const metadata: Metadata = {
  title: "30hours — Make the in-between count",
  description: "Your route. Your curiosity. A personal audio lesson that fits the way you're going.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "30hours" },
};
export const viewport: Viewport = { themeColor: "#f1eee7", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
