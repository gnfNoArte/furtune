import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "hfNoArte", template: "%s · hfNoArte" },
  description: "Hunt for NoArte — a personal AI job-hunting agent that finds opportunities, prepares applications and keeps you organised.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#09090c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
