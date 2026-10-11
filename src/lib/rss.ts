// RSS 2.0 feed-এর pure রেন্ডারার (SDK/UI-মুক্ত; P4b-২, Arch §১৭ P4b)। `scripts/build-seo.ts` build-সময়ে `rss.xml` লেখে।
// posts = build-ডেটার ক্রম (`publishedAt desc`), শুধু published+public; পাঠক-রিকোয়েস্টে Worker চলে না।
import { bodyToHtml } from "./docHtml";
import type { FeedMode } from "./enums";
import { postExcerpt, blogPath } from "./publicSite";
import { trimSlash } from "./seo";

/** `path` না থাকলে `/blog/<slug>`; অধ্যায় ইত্যাদির জন্য নিজের পথ (P14c-২) */
export type FeedPost = { slug: string; title: string; excerpt: string; body: string; publishedAt?: Date; updatedAt: Date; path?: string };

export const FEED_PATH = "/rss.xml";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// XML 1.0-এ অবৈধ character বাদ (পেস্ট-করা লেখায় আসতে পারে — নইলে পুরো feed অবৈধ হয়); regex নয় (ESLint no-control-regex)
const xmlOk = (c: number): boolean =>
  c === 9 || c === 10 || c === 13 || (c >= 0x20 && c <= 0xd7ff) || (c >= 0xe000 && c <= 0xfffd) || (c >= 0x10000 && c <= 0x10ffff);
const strip = (s: string): string =>
  Array.from(s)
    .filter((ch) => xmlOk(ch.codePointAt(0) ?? 0))
    .join("");
const x = (s: string): string => esc(strip(s));

const rfc822 = (d: Date): string => d.toUTCString();
const validDate = (d: Date | undefined): d is Date => !!d && !Number.isNaN(d.getTime());

export function renderRss(opts: {
  siteUrl: string;
  title: string;
  description: string;
  posts: readonly FeedPost[];
  items: number;
  mode: FeedMode;
}): string {
  const base = trimSlash(opts.siteUrl);
  const list = opts.posts.slice(0, Math.max(0, opts.items));
  const newest = list.map((p) => (validDate(p.publishedAt) ? p.publishedAt : p.updatedAt)).filter(validDate);
  const last = newest.reduce<Date | undefined>((m, d) => (!m || d > m ? d : m), undefined);
  const item = (p: FeedPost): string => {
    const url = `${base}${p.path ?? blogPath(p.slug)}`;
    const when = validDate(p.publishedAt) ? p.publishedAt : p.updatedAt;
    const full = opts.mode === "full" ? bodyToHtml(p.body) : "";
    return (
      `    <item>\n` +
      `      <title>${x(p.title.trim() || p.slug)}</title>\n` +
      `      <link>${x(url)}</link>\n` +
      `      <guid isPermaLink="true">${x(url)}</guid>\n` +
      (validDate(when) ? `      <pubDate>${rfc822(when)}</pubDate>\n` : "") +
      `      <description>${x(postExcerpt(p))}</description>\n` +
      (full !== "" ? `      <content:encoded>${x(full)}</content:encoded>\n` : "") +
      `    </item>\n`
    );
  };
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n` +
    `  <channel>\n` +
    `    <title>${x(opts.title)}</title>\n` +
    `    <link>${x(`${base}/`)}</link>\n` +
    `    <description>${x(opts.description.trim() || opts.title)}</description>\n` +
    `    <language>bn</language>\n` +
    (last ? `    <lastBuildDate>${rfc822(last)}</lastBuildDate>\n` : "") +
    `    <atom:link href="${x(`${base}${FEED_PATH}`)}" rel="self" type="application/rss+xml"/>\n` +
    list.map(item).join("") +
    `  </channel>\n</rss>\n`
  );
}
