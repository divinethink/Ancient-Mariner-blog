import { describe, expect, it } from "vitest";
import { bodyToHtml } from "./docHtml";
import { renderRss, type FeedPost } from "./rss";

const doc = (content: unknown[]) => JSON.stringify({ type: "doc", content });
const p = (text: string, marks?: unknown[]) => ({ type: "paragraph", content: [{ type: "text", text, ...(marks ? { marks } : {}) }] });

const mk = (slug: string, o: Partial<FeedPost> = {}): FeedPost => ({
  slug,
  title: `শিরোনাম ${slug}`,
  excerpt: "সারাংশ",
  body: doc([p("লেখা <script>alert(1)</script> & আরও")]),
  publishedAt: new Date("2026-10-01T06:00:00Z"),
  updatedAt: new Date("2026-10-02T06:00:00Z"),
  ...o,
});

describe("bodyToHtml", () => {
  it("allowed node/mark HTML-এ; টেক্সট escape", () => {
    const h = bodyToHtml(doc([{ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "হেড" }] }, p("a<b", [{ type: "bold" }])]));
    expect(h).toBe("<h3>হেড</h3><p><strong>a&lt;b</strong></p>");
  });
  it("অনিরাপদ লিংক বাদ (টেক্সট থাকে); নিরাপদ লিংক rel-সহ", () => {
    const bad = bodyToHtml(doc([p("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])]));
    expect(bad).toBe("<p>x</p>");
    const ok = bodyToHtml(doc([p("x", [{ type: "link", attrs: { href: "https://a.dev/?q=1&r=2" } }])]));
    expect(ok).toBe('<p><a href="https://a.dev/?q=1&amp;r=2" rel="noopener noreferrer">x</a></p>');
  });
  it("blocked node (iframe/script) কিছুই দেয় না; বিকৃত body = \"\"", () => {
    expect(bodyToHtml(doc([{ type: "iframe" }, { type: "script", text: "x" }]))).toBe("");
    expect(bodyToHtml("not json")).not.toContain("<script");
  });
});

describe("renderRss", () => {
  const base = { siteUrl: "https://ex.dev/", title: "ব্লগ & আমি", description: "", items: 10 };
  it("channel: atom self, language, description fallback = title, trailing slash বাদ", () => {
    const x = renderRss({ ...base, posts: [mk("a")], mode: "excerpt" });
    expect(x).toContain("<title>ব্লগ &amp; আমি</title>");
    expect(x).toContain("<description>ব্লগ &amp; আমি</description>");
    expect(x).toContain('<atom:link href="https://ex.dev/rss.xml" rel="self" type="application/rss+xml"/>');
    expect(x).toContain("<language>bn</language>");
    expect(x).toContain("<link>https://ex.dev/</link>");
  });
  it("excerpt মোডে content:encoded নেই; full মোডে আছে ও escape-করা (script অক্ষম)", () => {
    expect(renderRss({ ...base, posts: [mk("a")], mode: "excerpt" })).not.toContain("content:encoded>");
    const full = renderRss({ ...base, posts: [mk("a")], mode: "full" });
    expect(full).toContain("<content:encoded>&lt;p&gt;");
    expect(full).not.toContain("<script");
  });
  it("items সীমা মানে; বাংলা slug percent-encoded; guid permalink", () => {
    const posts = ["ক", "খ", "গ"].map((s) => mk(s));
    const x = renderRss({ ...base, posts, items: 2, mode: "excerpt" });
    expect(x.match(/<item>/g)).toHaveLength(2);
    expect(x).toContain("<guid isPermaLink=\"true\">https://ex.dev/blog/%E0%A6%95</guid>");
  });
  it("pubDate RFC-822 (UTC); publishedAt না থাকলে updatedAt; শিরোনাম খালি হলে slug", () => {
    const x = renderRss({ ...base, posts: [mk("a", { publishedAt: undefined, title: " " })], mode: "excerpt" });
    expect(x).toContain("<pubDate>Fri, 02 Oct 2026 06:00:00 GMT</pubDate>");
    expect(x).toContain("<title>a</title>");
  });
  it("control character বাদ; খালি তালিকায়ও বৈধ channel", () => {
    const x = renderRss({ ...base, posts: [mk("a", { title: "ক\u0001খ" })], mode: "excerpt" });
    expect(x).toContain("<title>কখ</title>");
    const e = renderRss({ ...base, posts: [], mode: "full" });
    expect(e).toContain("</channel>");
    expect(e).not.toContain("<item>");
    expect(e).not.toContain("lastBuildDate");
  });
});
