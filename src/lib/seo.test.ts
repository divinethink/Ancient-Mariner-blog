import { describe, expect, it } from "vitest";
import { AI_CRAWLERS, MAX_SITEMAP_URLS, articleJsonLd, buildSeo, normalizeSeoInput, resolvePostSeo, sameSeo, renderRobots, renderSitemap, verificationToken } from "./seo";

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

describe("renderSitemap extraEntries (P14c-২)", () => {
  it("নিজের lastmod-সহ এন্ট্রি আসে; মোট-সীমায় গণনা হয়", () => {
    const x = renderSitemap("https://ex.dev", [], [], [{ path: "/works/a/b", lastmod: new Date("2026-03-01T00:00:00Z") }, { path: "/works" }]);
    expect(x).toContain("<loc>https://ex.dev/works/a/b</loc><lastmod>2026-03-01T00:00:00.000Z</lastmod>");
    expect(x).toContain("<loc>https://ex.dev/works</loc></url>");
    const many = Array.from({ length: MAX_SITEMAP_URLS }, (_, i) => ({ path: `/w/${i}` }));
    expect(() => renderSitemap("https://ex.dev", [], [], many)).toThrow();
  });
});

describe("renderSitemap", () => {
  it("extraPaths (/blog, category…) home-এর পরে আসে; সীমায় গোনা হয়", () => {
    const x = renderSitemap("https://ex.dev", [{ slug: "a", updatedAt: new Date("2026-02-01T00:00:00Z") }], ["/blog", "/category/x"]);
    expect(x).toContain("<loc>https://ex.dev/blog</loc>");
    expect(x).toContain("<loc>https://ex.dev/category/x</loc>");
    const posts = Array.from({ length: MAX_SITEMAP_URLS - 1 }, () => ({ slug: "a", updatedAt: new Date() }));
    expect(() => renderSitemap("https://ex.dev", posts, ["/blog"])).toThrow();
  });
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

describe("P6-৩ক: ogImage ও verification", () => {
  const og = "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,g_auto,w_1200,h_630/blog/abc";
  it("cover-এর ogImage ডিফল্টের আগে; ১২০০×৬৩০; twitter large", () => {
    const m = buildSeo({ ...base, ogImage: og });
    expect(m.openGraph.images).toEqual([{ url: og, width: 1200, height: 630 }]);
    expect((m.twitter as { card: string; images: string[] }).card).toBe("summary_large_image");
    expect((m.twitter as { images: string[] }).images).toEqual([og]);
  });
  it("অ-https ogImage উপেক্ষিত ⇒ ডিফল্ট; কিছুই না থাকলে images নেই", () => {
    expect(buildSeo({ ...base, ogImage: "http://x.test/a.jpg" }).openGraph.images).toEqual([{ url: "https://ex.dev/og-default.png" }]);
    expect(buildSeo({ ...base, ogImage: "javascript:alert(1)", hasOgImage: false }).openGraph.images).toBeUndefined();
  });
  it("verificationToken: বৈধ token থাকে, খালি/অবৈধ/ছোট বাদ", () => {
    const t = "abcDEF123_-abcDEF123_-xyz";
    expect(verificationToken(`  ${t} `)).toBe(t);
    expect(verificationToken(undefined)).toBeUndefined();
    expect(verificationToken("short")).toBeUndefined();
    expect(verificationToken('"><script>alert(1)</script>aaaaaaaaaaaaaaaa')).toBeUndefined();
  });
});

describe("P10a-১ per-post SEO", () => {
  const base = { siteName: "S", title: "T", path: "/blog/a", type: "article" as const, hasOgImage: false };
  it("noindex লেখা: ইনডেক্স চালু থাকলেও robots index=false, follow=true", () => {
    expect(buildSeo({ ...base, allowIndexing: true, noindex: true }).robots).toEqual({ index: false, follow: true });
    expect(buildSeo({ ...base, allowIndexing: true }).robots).toEqual({ index: true, follow: true });
    expect(buildSeo({ ...base, allowIndexing: false, noindex: false }).robots).toBeUndefined();
  });
  it("sitemap থেকে noindex লেখা বাদ", () => {
    const d = new Date("2026-02-01T00:00:00Z");
    const x = renderSitemap("https://ex.dev", [{ slug: "keep", updatedAt: d }, { slug: "hide", updatedAt: d, seo: { noindex: true } }]);
    expect(x).toContain("/blog/keep");
    expect(x).not.toContain("/blog/hide");
  });
  it("resolvePostSeo: override বনাম ডিফল্ট", () => {
    const d = { title: "লেখা", description: "সারাংশ", siteName: "ব্লগ" };
    expect(resolvePostSeo(undefined, d)).toMatchObject({ title: "লেখা — ব্লগ", description: "সারাংশ", noindex: false });
    expect(resolvePostSeo({ title: " X ", description: "  ", noindex: true, ogImageId: "m1" }, d)).toEqual({ title: "X", description: "সারাংশ", noindex: true, ogImageId: "m1" });
  });
  it("normalizeSeoInput: খালি ⇒ null; undefined key নেই; sameSeo", () => {
    expect(normalizeSeoInput({ title: " ", description: "", ogImageId: null, noindex: false })).toBeNull();
    const n = normalizeSeoInput({ title: "a", description: "", ogImageId: null, noindex: true });
    expect(n).toEqual({ title: "a", noindex: true });
    expect(sameSeo(n, { title: "a", noindex: true })).toBe(true);
    expect(sameSeo(null, undefined)).toBe(true);
    expect(sameSeo(n, null)).toBe(false);
  });
  it("articleJsonLd: বৈধ JSON, '<' escaped, http ছবি বাদ", () => {
    const s = articleJsonLd({ siteUrl: "https://ex.dev/", siteName: "S", headline: "a</script>b", path: "/blog/x", image: "http://x/y.png", publishedTime: new Date("2026-01-01T00:00:00Z") });
    expect(s).not.toContain("<");
    const o = JSON.parse(s);
    expect(o["@type"]).toBe("Article");
    expect(o.headline).toBe("a</script>b");
    expect(o.url).toBe("https://ex.dev/blog/x");
    expect(o.image).toBeUndefined();
    expect(o.datePublished).toBe("2026-01-01T00:00:00.000Z");
  });
});
