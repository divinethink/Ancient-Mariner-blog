// পাবলিক সাইট build-এর pure সহায়ক (SDK/UI-মুক্ত): excerpt-fallback, পুরনো-slug redirect পরিকল্পনা (Arch §২)।
import { docToText, makeExcerpt, parseBody } from "./editorDoc";

/** Workers assets-এর `_redirects` static rule সীমা (Arch §৫ ঙ) */
export const MAX_STATIC_REDIRECTS = 2000;

export type SlugRef = { slug: string; slugHistory: readonly string[] };
export type SlugMove = { from: string; to: string };

/** পাবলিক লেখার পথ; slug percent-encoded (বাংলা slug-সহ) */
export const blogPath = (slug: string): string => `/blog/${encodeURIComponent(slug)}`;

/** পাবলিক সংগঠন-পথ; slug percent-encoded (taxonomy slug তৈরির পর অপরিবর্তিত — P3a-১) */
export const BLOG_INDEX_PATH = "/blog";
export const categoryPath = (slug: string): string => `/category/${encodeURIComponent(slug)}`;
export const tagPath = (slug: string): string => `/tag/${encodeURIComponent(slug)}`;
export const seriesPath = (slug: string): string => `/series/${encodeURIComponent(slug)}`;

/** নিজের সারাংশ খালি হলে লেখা থেকে স্বয়ংক্রিয় (Publish panel-এর hint-এর সাথে সঙ্গতি) */
export function postExcerpt(p: { excerpt: string; body: string }): string {
  const own = p.excerpt.trim();
  return own !== "" ? own : makeExcerpt(docToText(parseBody(p.body)));
}

// `_redirects`-এ শুধু নিরাপদ ASCII slug (slugify lowercase করে); বাকি সব stub পেজে
const REDIRECTABLE = /^[a-z0-9-]+$/;

/**
 * পুরনো slug (`slugHistory`) → বর্তমান slug। posts = `publishedAt desc` (build-ডেটার ক্রম)।
 * - ASCII → `redirects` (build-সময়ে `_redirects`-এ 308)
 * - বাংলা/non-ASCII → `stubs` (`_redirects` মেলে না — Arch §২; meta-refresh stub পেজ)
 * সংঘাতে নতুন/জীবিত পোস্টের slug-ই জেতে; একই পুরনো slug একাধিক পোস্টের history-তে থাকলে আগেরটা (নতুনটা) জেতে।
 */
export function planSlugMoves(posts: readonly SlugRef[]): { redirects: SlugMove[]; stubs: SlugMove[] } {
  const live = new Set(posts.map((p) => p.slug));
  const seen = new Set<string>();
  const redirects: SlugMove[] = [];
  const stubs: SlugMove[] = [];
  for (const p of posts) {
    for (const old of p.slugHistory) {
      if (old === "" || old === p.slug || live.has(old) || seen.has(old)) continue;
      seen.add(old);
      (REDIRECTABLE.test(old) ? redirects : stubs).push({ from: old, to: p.slug });
    }
  }
  return { redirects, stubs };
}

/** `_redirects` ফাইলের লাইন (308); খালি হলে "" */
export function renderRedirects(moves: readonly SlugMove[]): string {
  return moves.map((m) => `${blogPath(m.from)} ${blogPath(m.to)} 308\n`).join("");
}
