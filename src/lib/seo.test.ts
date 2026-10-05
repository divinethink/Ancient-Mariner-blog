import { describe, expect, it } from "vitest";
import { AI_CRAWLERS, MAX_SITEMAP_URLS, buildSeo, renderRobots, renderSitemap } from "./seo";

const base = {
  siteUrl: "https://ex.dev/",
  siteName: "ব্লগ",
  title: "শিরোনাম",
  description: "  একটু  \n সারাংশ ",
  path: "/blog/%E0%A6%95",
  allowIndexing: true,
  type: "article" as const,
  hasOgImage: true,
};

describe("buildSeo", () => {
  it("canonical/OG/twitter বসায়; description পরিষ্কার; trailing slash বাদ", () => {
    const m = buildSeo({ ...base, publishedTime: new Date("2026-01-02T00:00:00Z") });
    expect(m.alternates?.canonical).toBe("https://ex.dev/blog/%E0%A6%95");
    expect(m.description).toBe("একটু সারাংশ");
    expect(m.openGraph).toMatchObject({ type: "article", url: "https://ex.dev/blog/%E0%A6%95", publishedTime: "2026-01-02T00:00:00.000Z" });
    expect(m.twitter).toMatchObject({ card: "summary_large_image", images: ["https://ex.dev/og-default.png"] });
  });
  it("ইনডেক্স চালু হলে robots index; বন্ধ হলে robots নেই (noindex বহাল)", () => {
    expect(buildSeo(base).robots).toEqual({ index: true, follow: true });
    expect(buildSeo({ ...base, allowIndexing: false }).robots).toBeUndefined();
  });
  it("og:image ফাইল না থাকলে tag বাদ; siteUrl না থাকলে canonical/url বাদ; Home path '/'", () => {
    const m = buildSeo({ ...base, hasOgImage: false, siteUrl: undefined, description: " ", type: "website", path: "/" });
    expect(m.alternates).toBeUndefined();
    expect(m.description).toBeUndefined();
    expect(m.openGraph).not.toHaveProperty("images");
    expect(m.openGraph).not.toHaveProperty("url");
    expect(m.twitter).toMatchObject({ card: "summary" });
    expect(buildSeo({ ...base, path: "/" }).alternates?.canonical).toBe("https://ex.dev/");
  });
});

describe("renderSitemap", () => {
  it("home + লেখা, XML-escape ও lastmod", () => {
    const x = renderSitemap("https://ex.dev/", [{ slug: "a&b", updatedAt: new Date("2026-02-01T00:00:00Z") }]);
    expect(x).toContain("<loc>https://ex.dev/</loc><lastmod>2026-02-01T00:00:00.000Z</lastmod>");
    expect(x).toContain("<loc>https://ex.dev/blog/a%26b</loc>");
    expect(renderSitemap("https://ex.dev", [{ slug: "x&y".replace("%", ""), updatedAt: new Date() }])).not.toContain("&y");
  });
  it("লেখা না থাকলে শুধু home; অবৈধ তারিখে lastmod বাদ", () => {
    const x = renderSitemap("https://ex.dev", []);
    expect(x.match(/<url>/g)).toHaveLength(1);
    expect(renderSitemap("https://ex.dev", [{ slug: "a", updatedAt: new Date("x") }])).not.toMatch(/Invalid|NaN/);
  });
  it("সীমা ছাড়ালে throw", () => {
    const posts = Array.from({ length: MAX_SITEMAP_URLS }, (_, i) => ({ slug: `s${i}`, updatedAt: new Date(0) }));
    expect(() => renderSitemap("https://ex.dev", posts)).toThrow();
  });
});

describe("renderRobots", () => {
  const o = { siteUrl: "https://ex.dev/", allowIndexing: true, blockAiCrawlers: false };
  it("ইনডেক্স বন্ধ: Disallow: / ও sitemap নেই", () => {
    const r = renderRobots({ ...o, allowIndexing: false, blockAiCrawlers: true });
    expect(r).toBe("User-agent: *\nDisallow: /\n");
  });
  it("ইনডেক্স চালু: private পথ Disallow + Sitemap", () => {
    const r = renderRobots(o);
    for (const p of ["/dashboard", "/login", "/api"]) expect(r).toContain(`Disallow: ${p}\n`);
    expect(r).toContain("Sitemap: https://ex.dev/sitemap.xml");
    expect(r).not.toContain("GPTBot");
  });
  it("AI-crawler ব্লক চালু হলে সবাই Disallow: /", () => {
    const r = renderRobots({ ...o, blockAiCrawlers: true });
    for (const a of AI_CRAWLERS) expect(r).toContain(`User-agent: ${a}\n`);
    expect(r.indexOf("Disallow: /\n")).toBeLessThan(r.indexOf("User-agent: *"));
  });
});
