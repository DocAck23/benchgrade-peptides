import type { Metadata } from "next";
import { Geist, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { RUOBanner } from "@/components/layout/RUOBanner";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/** Geist — Vercel's clinical geometric sans, used for display headings.
 *  Replaces the editorial Instrument Serif per user feedback: more clear,
 *  more clinical, closer to Valeria.health / NuScience reference typography. */
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Bench Grade Peptides — Research-grade synthetic peptides",
    template: "%s · Bench Grade Peptides",
  },
  description:
    "Research-grade synthetic peptides for laboratory use. HPLC-verified, COA-per-lot, cold-chain shipped. For laboratory research use only.",
  metadataBase: new URL("https://benchgradepeptides.com"),
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Bench Grade Peptides",
    description: "Research-grade synthetic peptides for laboratory use.",
    type: "website",
    siteName: "Bench Grade Peptides",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geist.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[color:var(--color-paper)] text-[color:var(--color-ink)]">
        <RUOBanner />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
