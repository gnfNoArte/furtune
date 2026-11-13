import type { Metadata, Viewport } from "next";
import { Amarante, Cormorant } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

const cormorant = Cormorant({ subsets: ["latin"], weight: ["300", "400", "500", "600"], style: ["normal", "italic"], variable: "--font-cormorant", display: "swap" });
// Amarante is reserved for the NA monogram only.
const amarante = Amarante({ subsets: ["latin"], weight: "400", variable: "--font-amarante", display: "swap" });

export const metadata: Metadata = {
  title: { default: "hfNoArte", template: "%s · hfNoArte" },
  description: "Hunt for NoArte — Olayemi's personal job-hunting agent: finds opportunities, prepares applications, keeps everything organised.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#F7F4EC", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${cormorant.variable} ${amarante.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
