import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Montserrat } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

import { RUOBanner } from "@/components/layout/RUOBanner";
import { Header } from "@/components/layout/Header";
import { HeaderAccountSlot } from "@/components/layout/HeaderAccountSlot";
import { Footer } from "@/components/layout/Footer";
import { CartProvider } from "@/lib/cart/CartContext";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ClarityScript } from "@/components/analytics/ClarityScript";
import { PrelaunchPopup } from "@/components/prelaunch/PrelaunchPopup";
import { Suspense } from "react";
import { headers } from "next/headers";
import { SITE_URL } from "@/lib/site";
import { BRAND } from "@/lib/brand";
import { ROUTES } from "@/lib/routes";

/** Glacial Indifference — v2 display + body face. Self-hosted (SIL OFL).
 *  Replaces Cinzel (display) and Cormorant Garamond (editorial) from v1.
 *  See public/fonts/glacial-indifference/LICENSE.txt and
 *  scripts/convert-fonts-to-woff2.py for the conversion recipe.
 *
 *  font-display: swap allows a fallback-to-final font shift; the
 *  adjustFallback="Arial" keeps CLS ≤ 0.05 on the swap. */
const glacial = localFont({
  src: [
    {
      path: "../../public/fonts/glacial-indifference/GlacialIndifference-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/glacial-indifference/GlacialIndifference-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-glacial",
  display: "swap",
  adjustFontFallback: "Arial",
  preload: true,
});

/** Montserrat — sub-display / labels / eyebrows / ALL-CAPS UI text.
 *  Tracked wide. Weights 200/500/700 cover thin-tracked sub-lines,
 *  default UI weight, and bold gold-on-cream eyebrows (per Q6 rule). */
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
  weight: ["200", "300", "500", "600", "700"],
});

/** Inter — kept as a transitional UI sans during the Foundation codemod.
 *  Existing components reference it via classes; removing it would break
 *  intermediate commits. Removed (or aliased) in commit 18+. */
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
    default: `${BRAND.name} — ${BRAND.shortDescription}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  metadataBase: new URL(SITE_URL),
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: BRAND.name,
    description: BRAND.shortDescription,
    type: "website",
    siteName: BRAND.name,
    locale: "en_US",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.name,
    description: BRAND.shortDescription,
  },
};

// Bot/crawler UA classifier used to suppress the pre-launch popup
// before the page renders. Pattern set lifted from
// classifyDevice() in src/app/api/analytics/route.ts (we keep them
// in sync — anything that gets dropped from analytics shouldn't see
// the marketing popup either).
const BOT_RE =
  /bot|crawl|spider|slurp|preview|fetch|duckduck|facebookexternalhit|whatsapp|linkedin|twitter|skype|slack|telegrambot|discordbot|embedly|google-inspectiontool|adsbot/i;

function looksLikeBot(ua: string | null | undefined): boolean {
  if (!ua) return true;
  return BOT_RE.test(ua);
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerBag = await headers();
  const ua = headerBag.get("user-agent");
  const isBot = looksLikeBot(ua);
  return (
    <html
      lang="en"
      className={`${glacial.variable} ${montserrat.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[color:var(--color-paper)] text-[color:var(--color-ink)]">
        {/* Schema.org Organization markup — site-wide, gives Google
            the canonical name + logo + contact for knowledge-graph
            and rich-result eligibility. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": `${SITE_URL}/#org`,
              name: BRAND.name,
              legalName: BRAND.legalName,
              url: SITE_URL,
              logo: `${SITE_URL}${BRAND.logoMetallic}`,
              email: BRAND.email,
              address: {
                "@type": "PostalAddress",
                ...BRAND.address,
              },
              sameAs: BRAND.sameAs,
              description: BRAND.description,
            }),
          }}
        />
        {/* WebSite + SearchAction — makes the site eligible for the
            Google sitelinks search box. The catalogue page already
            filters by ?q= via CatalogueBrowser, so we route searches
            there. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              url: SITE_URL,
              name: BRAND.name,
              publisher: { "@id": `${SITE_URL}/#org` },
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${SITE_URL}${ROUTES.CATALOG}?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
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
        {/* First-party analytics beacon. Wrapped in Suspense because
            useSearchParams suspends during prerender; the actual work
            is client-only and never blocks render. */}
        <Suspense fallback={null}>
          <AnalyticsBeacon />
        </Suspense>
        <SpeedInsights />
        <ClarityScript />
        {/* Pre-launch waitlist popup — suppressed for bots/crawlers
            via server-side UA scan (so Google doesn't see "first
            100 orders" promotional copy in indexed page text). */}
        <PrelaunchPopup suppressed={isBot} />
      </body>
    </html>
  );
}
