// WordPress ইমপোর্টের লেখার পরিকল্পনা (P3c-খ): pure, SDK/UI-মুক্ত। প্ল্যান (dry-run) → কোন লেখা লিখবে, কোন slug, কোন id।
// idempotency: post-id `(site, wpPostId)` থেকে নির্ধারিত ⇒ আবার চালালে একই লেখা চিনে skip হয় (slug-lock-এর postId থেকে)।
import { withSuffix } from "../slug";
import type { ImportPlan, PlannedPost } from "./plan";

export const IMPORT_MAX_TAGS = 20;
export const TERM_NAME_LIMIT = 60;
/** এক batch-এর body-বাইট বাজেট (Firestore commit ≤ ১০MiB; নিরাপদ ফাঁক) ও সর্বোচ্চ লেখা/chunk (প্রতিটায় ২ op) */
export const CHUNK_MAX_BYTES = 4 * 1024 * 1024;
export const CHUNK_MAX_POSTS = 100;

/** নাম-মেলানোর কাঠামো: NFC, ছোট হাতের, বাড়তি ফাঁকা বাদ */
export const normName = (s: string): string => s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

/** term-নাম: ফাঁকা গুছিয়ে ≤৬০ অক্ষর (taxonomy সীমা) */
export const termName = (s: string): string =>
  Array.from(s.normalize("NFC").trim().replace(/\s+/g, " ")).slice(0, TERM_NAME_LIMIT).join("").trim();

function fnv(s: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36).padStart(7, "0");
}
const hash14 = (s: string) => fnv(s, 2166136261) + fnv(s, 3266489917);

/** নির্ধারিত post-id (`^[A-Za-z0-9]{1,40}$`): সোর্স-নাম + WordPress post-id */
export function importPostId(site: string, wpId: string): string | null {
  const w = wpId.replace(/[^A-Za-z0-9]/g, "");
  return w ? `wp${hash14(normName(site))}x${w}`.slice(0, 40) : null;
}
/** নির্ধারিত term-id: একই নাম আবার/retry-তে একই doc (taxonomy create idempotent) */
export const importTermId = (kind: "categories" | "tags", name: string): string =>
  `${kind === "categories" ? "wpc" : "wpt"}${hash14(normName(name))}`;

export type ImportDraft = {
  id: string;
  title: string;
  slug: string;
  body: string;
  excerpt: string;
  wordCount: number;
  bodyBytes: number;
  /** WordPress-এর প্রথম ক্যাটাগরি (পোস্টে একটাই); বাকিগুলো importSource.categories-এ */
  categoryName?: string;
  tagNames: string[];
  importSource: {
    site: string;
    wpPostId: string;
    originalDate?: Date;
    originalUrl?: string;
    sourceStatus?: string;
    categories: string[];
    tags: string[];
  };
};

export type WritePlan = {
  writes: ImportDraft[];
  already: number;
  invalid: number;
  oversize: string[];
};

const uniqByNorm = (names: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const t = termName(n);
    const k = normName(t);
    if (t && !seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  }
  return out;
};

/**
 * `owners` = বিদ্যমান `slugs` (slug → postId)। যে post-id কোনো lock-এর মালিক সে আগেই ইমপোর্টেড (ট্র্যাশ/slug-বদল হলেও lock থাকে) ⇒ skip।
 * নতুনগুলোর slug: `plan.slug`; বিদ্যমান/আগের-লেখার সাথে সংঘাতে `-২`, `-৩`…। ৯০০KB-ছাড়ানো লেখা লেখা যায় না ⇒ বাদ ও তালিকায়।
 */
export function planWrites(plan: ImportPlan, site: string, owners: ReadonlyMap<string, string>): WritePlan {
  const done = new Set(owners.values());
  const taken = new Set(owners.keys());
  const out: WritePlan = { writes: [], already: 0, invalid: 0, oversize: [] };
  for (const p of plan.posts) {
    const id = importPostId(site, p.wpId);
    if (!id) {
      out.invalid++;
      continue;
    }
    if (done.has(id)) {
      out.already++;
      continue;
    }
    if (p.flags.oversize) {
      out.oversize.push(p.title);
      continue;
    }
    let n = 1;
    while (taken.has(withSuffix(p.slug, n))) n++;
    const slug = withSuffix(p.slug, n);
    taken.add(slug);
    out.writes.push(toDraft(p, id, slug, site));
  }
  return out;
}

function toDraft(p: PlannedPost, id: string, slug: string, site: string): ImportDraft {
  const cats = uniqByNorm(p.categories);
  const tags = uniqByNorm(p.tags);
  return {
    id,
    title: p.title,
    slug,
    body: p.body,
    excerpt: p.excerpt,
    wordCount: p.wordCount,
    bodyBytes: p.bodyBytes,
    categoryName: cats[0],
    tagNames: tags.slice(0, IMPORT_MAX_TAGS),
    importSource: {
      site: site.trim(),
      wpPostId: p.wpId,
      originalDate: p.originalDate ?? undefined,
      originalUrl: p.originalUrl || undefined,
      sourceStatus: p.sourceStatus || undefined,
      categories: cats,
      tags,
    },
  };
}

/** লেখাগুলোকে batch-chunk-এ ভাগ: ≤CHUNK_MAX_POSTS ও ≤CHUNK_MAX_BYTES (এর চেয়ে বড় একক লেখা একাই) */
export function chunkWrites(items: readonly ImportDraft[]): ImportDraft[][] {
  const out: ImportDraft[][] = [];
  let cur: ImportDraft[] = [];
  let bytes = 0;
  for (const it of items) {
    if (cur.length > 0 && (cur.length >= CHUNK_MAX_POSTS || bytes + it.bodyBytes > CHUNK_MAX_BYTES)) {
      out.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(it);
    bytes += it.bodyBytes;
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

/** লেখাগুলোর দরকারি term-নাম (ইউনিক, প্রথম-দেখা ক্রমে) */
export function wantedTerms(writes: readonly ImportDraft[]): { categories: string[]; tags: string[] } {
  return {
    categories: uniqByNorm(writes.flatMap((w) => (w.categoryName ? [w.categoryName] : []))),
    tags: uniqByNorm(writes.flatMap((w) => w.tagNames)),
  };
}
