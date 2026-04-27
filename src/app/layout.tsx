import type { Metadata } from "next";
import {
  Cinzel,
  Cormorant_Garamond,
  Inter,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

import { RUOBanner } from "@/components/layout/RUOBanner";
import { Header } from "@/components/layout/Header";
import { HeaderAccountSlot } from "@/components/layout/HeaderAccountSlot";
import { Footer } from "@/components/layout/Footer";
import { CartProvider } from "@/lib/cart/CartContext";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SITE_URL } from "@/lib/site";

/** Cinzel — Roman-cap display face. Used for the wordmark, hero headlines,
 *  virtue marks, premium-tier titles. Closest free analogue to the
 *  monumental capitals on the finalized Bench Grade logo. */
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

/** Cormorant Garamond — transitional editorial serif. Used for email
 *  headlines, /why-no-cards prose, and longer editorial copy. */
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

/** Inter — UI sans for navigation, forms, transactional body, dashboards. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/** JetBrains Mono — tabular numerals for prices, lot numbers, COA IDs,
 *  SKU strings. Data-only; never body. */
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
  metadataBase: new URL(SITE_URL),
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Bench Grade Peptides",
    description: "Research-grade synthetic peptides for laboratory use.",
    type: "website",
    siteName: "Bench Grade Peptides",
    locale: "en_US",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Bench Grade Peptides",
    description: "Research-grade synthetic peptides for laboratory use.",
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
      className={`${cinzel.variable} ${cormorant.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[color:var(--color-paper)] text-[color:var(--color-ink)]">
        <CartProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:bg-ink focus:text-paper focus:px-4 focus:py-2 focus:text-sm"
          >
            Skip to main content
          </a>
          <RUOBanner />
          <Header accountSlot={<HeaderAccountSlot />} />
          <main id="main" className="flex-1">{children}</main>
          <Footer />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
