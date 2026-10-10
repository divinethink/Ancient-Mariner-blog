// পাবলিক `/search` (P10a-২, Arch §১৭ P10a): build-সময়ের `search-index.json`, ব্রাউজারে শব্দ-prefix মিল — full-text না (F1)।
// pure, SDK/UI-মুক্ত। fold = P8b-র একই নিয়ম (NFC, ZWJ/ZWNJ বাদ, lower-case)।
import { foldOnly, tokenize } from "./fold";

export const SEARCH_INDEX_PATH = "/search-index.json";
export const SEARCH_PATH = "/search";
export const PUBLIC_SEARCH_LIMIT = 50;
/** একটা excerpt-এর index-সীমা (অক্ষর) — ফাইল ছোট রাখতে */
export const MAX_EXCERPT_CHARS = 200;

/** JSON-এ ছোট key: t=title, s=slug, e=excerpt, c=categoryName (নেই হলে বাদ), d=ISO প্রকাশ-তারিখ */
export type PublicSearchEntry = { t: string; s: string; e: string; c?: string; d?: string };
export type PublicSearchIndex = { v: 1; items: PublicSearchEntry[] };

/** `excerpt` = আগেই-নির্ধারিত সারাংশ (কলার `postExcerpt` দেয়) — এই ফাইল ভারী editor-কোড টানে না, তাই ক্লায়েন্ট bundle ছোট */
type PostLike = {
  title: string;
  slug: string;
  excerpt: string;
  categoryName?: string;
  publishedAt?: Date;
};

/** published+public লেখা → index (ক্রম বজায়; `body` টাইপেই নেই) */
export function buildPublicSearchIndex(posts: readonly PostLike[]): PublicSearchIndex {
  return {
    v: 1,
    items: posts.map((p) => {
      const e = p.excerpt;
      return {
        t: p.title,
        s: p.slug,
        e: e.length > MAX_EXCERPT_CHARS ? e.slice(0, MAX_EXCERPT_CHARS) : e,
        ...(p.categoryName ? { c: p.categoryName } : {}),
        ...(p.publishedAt && !Number.isNaN(p.publishedAt.getTime()) ? { d: p.publishedAt.toISOString() } : {}),
      };
    }),
  };
}

/** বিকৃত/অজানা-সংস্করণ JSON ⇒ null (পেজ error-state দেখায়, ভাঙে না) */
export function parsePublicSearchIndex(raw: unknown): PublicSearchIndex | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { v?: unknown; items?: unknown };
  if (r.v !== 1 || !Array.isArray(r.items)) return null;
  const items = r.items.flatMap((x): PublicSearchEntry[] => {
    if (!x || typeof x !== "object") return [];
    const o = x as Record<string, unknown>;
    if (typeof o.t !== "string" || typeof o.s !== "string") return [];
    return [{ t: o.t, s: o.s, e: typeof o.e === "string" ? o.e : "", ...(typeof o.c === "string" ? { c: o.c } : {}), ...(typeof o.d === "string" ? { d: o.d } : {}) }];
  });
  return { v: 1, items };
}

type Prepared = { entry: PublicSearchEntry; t: string[]; r: string[] };
const words = (s: string): string[] => foldOnly(s).split(/[\s\p{P}\p{S}]+/u).filter(Boolean);

/** লোডের সময় একবার folded শব্দ-তালিকা (প্রতি কী-স্ট্রোকে নয়) */
export function prepareSearch(index: PublicSearchIndex): Prepared[] {
  return index.items.map((entry) => ({
    entry,
    t: words(entry.t),
    r: words(`${entry.e} ${entry.c ?? ""} ${entry.s}`),
  }));
}

/**
 * সব শব্দ (AND) মিলতে হবে; একটা শব্দ মেলে যদি লেখার কোনো শব্দ তা দিয়ে শুরু হয় (prefix; পূর্ণ শব্দও prefix)।
 * স্কোর: শিরোনামে মিললে ৩, অন্যত্র ১ — বেশি স্কোর আগে; সমান হলে index-ক্রম (= সাম্প্রতিক আগে)।
 */
export function searchPublic(prepared: readonly Prepared[], query: string, limit = PUBLIC_SEARCH_LIMIT): PublicSearchEntry[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const scored: { entry: PublicSearchEntry; score: number; i: number }[] = [];
  prepared.forEach((p, i) => {
    let score = 0;
    for (const tok of tokens) {
      if (p.t.some((w) => w.startsWith(tok))) score += 3;
      else if (p.r.some((w) => w.startsWith(tok))) score += 1;
      else return; // একটা শব্দ না মিললে বাদ (AND)
    }
    scored.push({ entry: p.entry, score, i });
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.slice(0, limit).map((x) => x.entry);
}

/** `lib/publicSite.blogPath`-এর সমান (ক্লায়েন্ট-হালকা রাখতে আলাদা; test-এ মিলানো) */
export const searchResultPath = (e: PublicSearchEntry): string => `/blog/${encodeURIComponent(e.s)}`;
