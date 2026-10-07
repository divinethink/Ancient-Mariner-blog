// SEO-র pure সহায়ক (SDK/UI-মুক্ত): পাবলিক পেজের metadata, sitemap.xml, robots.txt (P2c-২; Arch §৬ siteSettings)।
// নীতি: fail-closed — allowIndexing=false হলে সর্বত্র noindex ও `Disallow: /`; root layout-এর noindex শুধু পাবলিক পেজ override করে।
import { blogPath } from "./publicSite";

/** sitemap-এর spec সীমা (৫০,০০০ URL); ছাড়ালে build থামে — owner-আলোচনা */
export const MAX_SITEMAP_URLS = 50000;

/** `public/og-default.png` — ফাইল থাকলে তবেই og:image (না থাকলে tag বাদ) */
export const OG_DEFAULT_PATH = "/og-default.png";

/** সবসময় ক্রলার-বন্ধ পথ (ইনডেক্স চালু থাকলেও) */
export const PRIVATE_PATHS = ["/dashboard", "/login", "/api"] as const;

/** পরিচিত AI-crawler/training bot (blockAiCrawlers চালু হলে প্রত্যেকের জন্য `Disallow: /`) */
export const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "PerplexityBot",
  "Bytespider",
  "Amazonbot",
  "Meta-ExternalAgent",
  "cohere-ai",
  "Diffbot",
] as const;

export type SeoInput = {
  /** SITE_URL (শেষে '/' থাকলে বাদ); অনুপস্থিত হলে canonical/og:url বাদ */
  siteUrl?: string;
  siteName: string;
  title: string;
  description?: string;
  /** '/' বা '/blog/…' (percent-encoded) */
  path: string;
  allowIndexing: boolean;
  type: "website" | "article";
  publishedTime?: Date;
  modifiedTime?: Date;
  /** og:image দেওয়া হবে কিনা (ফাইল-আছে-কিনা কলার জানে) */
  hasOgImage: boolean;
};

export type SeoMetadata = {
  title: string;
  description?: string;
  alternates?: { canonical: string };
  /** শুধু ইনডেক্স চালু থাকলে; নইলে undefined = root layout-এর noindex বহাল */
  robots?: { index: true; follow: true };
  openGraph: Record<string, unknown>;
  twitter: Record<string, unknown>;
};

export const trimSlash = (u: string): string => u.replace(/\/+$/, "");

/** খালি/শুধু-whitespace description → undefined */
const clean = (s?: string): string | undefined => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t === "" ? undefined : t;
};

export function buildSeo(i: SeoInput): SeoMetadata {
  const base = i.siteUrl ? trimSlash(i.siteUrl) : undefined;
  const url = base ? `${base}${i.path === "/" ? "/" : i.path}` : undefined;
  const description = clean(i.description);
  const images = i.hasOgImage && base ? [{ url: `${base}${OG_DEFAULT_PATH}` }] : undefined;
  const openGraph: Record<string, unknown> = {
    type: i.type,
    siteName: i.siteName,
    title: i.title,
    ...(description && { description }),
    ...(url && { url }),
    ...(images && { images }),
    ...(i.type === "article" && i.publishedTime && { publishedTime: i.publishedTime.toISOString() }),
    ...(i.type === "article" && i.modifiedTime && { modifiedTime: i.modifiedTime.toISOString() }),
  };
  return {
    title: i.title,
    ...(description && { description }),
    ...(url && { alternates: { canonical: url } }),
    ...(i.allowIndexing && { robots: { index: true as const, follow: true as const } }),
    openGraph,
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: i.title,
      ...(description && { description }),
      ...(images && { images: images.map((x) => x.url) }),
    },
  };
}

const xmlEscape = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export type SitemapPost = { slug: string; publishedAt?: Date; updatedAt: Date };

/** Home + extraPaths (`/blog`, category/tag/series — percent-encoded) + প্রতিটি পাবলিক লেখা; `lastmod` = updatedAt (অবৈধ হলে বাদ) */
export function renderSitemap(siteUrl: string, posts: readonly SitemapPost[], extraPaths: readonly string[] = []): string {
  const total = posts.length + extraPaths.length + 1;
  if (total > MAX_SITEMAP_URLS) {
    throw new Error(`sitemap সীমা (${MAX_SITEMAP_URLS}) ছাড়িয়েছে: ${total} — owner-আলোচনা`);
  }
  const base = trimSlash(siteUrl);
  const entry = (loc: string, d?: Date) => {
    const ok = d && !Number.isNaN(d.getTime());
    return `  <url><loc>${xmlEscape(loc)}</loc>${ok ? `<lastmod>${d.toISOString()}</lastmod>` : ""}</url>\n`;
  };
  const latest = posts.reduce<Date | undefined>((m, p) => (!m || p.updatedAt > m ? p.updatedAt : m), undefined);
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entry(`${base}/`, latest) +
    extraPaths.map((path) => entry(`${base}${path}`, latest)).join("") +
    posts.map((p) => entry(`${base}${blogPath(p.slug)}`, p.updatedAt)).join("") +
    `</urlset>\n`
  );
}

/**
 * robots.txt।
 * - ইনডেক্স বন্ধ: `User-agent: *` + `Disallow: /`, sitemap নেই (AI-bot-ও এতে ঢাকা)।
 * - ইনডেক্স চালু: /dashboard /login /api সবসময় Disallow + Sitemap; blockAiCrawlers হলে প্রতিটি AI-bot `Disallow: /`।
 */
export function renderRobots(opts: { siteUrl: string; allowIndexing: boolean; blockAiCrawlers: boolean }): string {
  if (!opts.allowIndexing) return "User-agent: *\nDisallow: /\n";
  const groups: string[] = [];
  if (opts.blockAiCrawlers) {
    groups.push(AI_CRAWLERS.map((a) => `User-agent: ${a}`).join("\n") + "\nDisallow: /\n");
  }
  groups.push(["User-agent: *", "Allow: /", ...PRIVATE_PATHS.map((p) => `Disallow: ${p}`)].join("\n") + "\n");
  groups.push(`Sitemap: ${trimSlash(opts.siteUrl)}/sitemap.xml\n`);
  return groups.join("\n");
}
