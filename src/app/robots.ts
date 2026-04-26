import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const PRIVATE_PATHS = ["/admin", "/admin/", "/checkout", "/checkout/", "/cart", "/api/"];

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
      // Default rule: search engines (Googlebot, Bingbot, etc.) and anything
      // not explicitly named below.
      {
        userAgent: "*",
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
