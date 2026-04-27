import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Private + consumer-facing paths that must not be indexed. The cart,
// checkout, account, affiliate, login, and auth surfaces all surface
// purchase-flow language ("dose", "stack", "subscribe") that risks
// drug-claim association in search snippets. Blog/news is also blocked
// pre-launch until copy is reviewed for B2B/researcher framing.
const PRIVATE_PATHS = [
  "/admin",
  "/admin/",
  "/checkout",
  "/checkout/",
  "/cart",
  "/cart/",
  "/account",
  "/account/",
  "/affiliate",
  "/affiliate/",
  "/login",
  "/login/",
  "/auth",
  "/auth/",
  "/api/",
  "/news",
  "/news/",
  "/coa",
  "/coa/",
];

// Search-engine crawlers we explicitly tighten further. Googlebot and
// AdsBot can index the public catalogue + research/about/contact pages,
// but must be kept off the consumer-facing purchase paths even via
// referer-based discovery, since AdsBot in particular fetches landing
// URLs for ad-policy review.
const SEARCH_CRAWLERS = [
  "Googlebot",
  "Googlebot-Image",
  "Googlebot-News",
  "Googlebot-Video",
  "AdsBot-Google",
  "AdsBot-Google-Mobile",
  "Mediapartners-Google",
  "Bingbot",
  "AdIdxBot",
  "msnbot",
];

// Training-only crawlers: scrape content to feed future model training. No
// upside for us — they don't surface us to users in real time. Block fully.
const TRAINING_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "Amazonbot",
  "Meta-ExternalAgent",
  "FacebookBot",
  "cohere-ai",
  "cohere-training-data-crawler",
  "Diffbot",
  "Omgilibot",
  "Omgili",
  "ImagesiftBot",
  "PetalBot",
  "Timpibot",
  "Webzio-Extended",
  "VelenPublicWebCrawler",
  "Scrapy",
];

// Live retrieval / agent crawlers: fetch on demand when a user asks an LLM
// "find me research peptides made in America." Allow — this is a discovery
// channel that aligns with our premium positioning.
const RETRIEVAL_CRAWLERS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-User",
  "Claude-Web",
  "PerplexityBot",
  "Perplexity-User",
  "MistralAI-User",
  "DuckAssistBot",
  "YouBot",
  "Applebot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default rule: search engines and anything not explicitly named
      // below. Catalogue + product pages remain crawlable; consumer
      // purchase-flow paths and the news/blog are walled off.
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      // Hard-block Googlebot + AdsBot from purchase-flow + consumer
      // surfaces to avoid drug-claim trigger words showing up in search
      // snippets or ad-landing-page reviews.
      {
        userAgent: SEARCH_CRAWLERS,
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      // Block training crawlers from the entire site.
      {
        userAgent: TRAINING_CRAWLERS,
        disallow: "/",
      },
      // Allow live AI-retrieval bots to fetch public content on demand.
      {
        userAgent: RETRIEVAL_CRAWLERS,
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
