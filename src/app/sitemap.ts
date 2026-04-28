import type { MetadataRoute } from "next";
import { CATEGORIES, PRODUCTS } from "@/lib/catalogue/data";
import { POPULAR_STACKS } from "@/lib/catalogue/stacks";
import { RESEARCH_ARTICLES } from "@/lib/research/articles";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, priority: 1.0, changeFrequency: "weekly", lastModified: now },
    { url: `${SITE_URL}/catalogue`, priority: 0.9, changeFrequency: "weekly", lastModified: now },
    { url: `${SITE_URL}/about`, priority: 0.6, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/compliance`, priority: 0.7, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/shipping`, priority: 0.5, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/payments`, priority: 0.5, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/coa`, priority: 0.5, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/contact`, priority: 0.5, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/terms`, priority: 0.4, changeFrequency: "yearly", lastModified: now },
    { url: `${SITE_URL}/privacy`, priority: 0.4, changeFrequency: "yearly", lastModified: now },
  ];

  const categoryEntries: MetadataRoute.Sitemap = CATEGORIES.map((c) => ({
    url: `${SITE_URL}/catalogue/${c.slug}`,
    priority: 0.8,
    changeFrequency: "weekly",
    lastModified: now,
  }));

  const productEntries: MetadataRoute.Sitemap = PRODUCTS.map((p) => ({
    url: `${SITE_URL}/catalogue/${p.category_slug}/${p.slug}`,
    priority: 0.7,
    changeFrequency: "weekly",
    lastModified: now,
  }));

  const stackEntries: MetadataRoute.Sitemap = POPULAR_STACKS.map((s) => ({
    url: `${SITE_URL}/catalogue/stacks/${s.slug}`,
    priority: 0.7,
    changeFrequency: "monthly",
    lastModified: now,
  }));

  const researchIndex: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/research`,
      priority: 0.7,
      changeFrequency: "weekly",
      lastModified: now,
    },
  ];

  const researchArticleEntries: MetadataRoute.Sitemap = RESEARCH_ARTICLES.map(
    (a) => ({
      url: `${SITE_URL}/research/${a.slug}`,
      priority: 0.6,
      changeFrequency: "yearly",
      lastModified: now,
    }),
  );

  return [
    ...staticEntries,
    ...categoryEntries,
    ...productEntries,
    ...stackEntries,
    ...researchIndex,
    ...researchArticleEntries,
  ];
}
