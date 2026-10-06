// WordPress WXR → dry-run পরিকল্পনা (P3c-ক): pure, কিছু লেখে না। XML-পার্স UI/adapter স্তরে (`WxrFile` তার আউটপুট)।
// সব লেখা Draft + (সোর্স-অবস্থা অনুযায়ী) Private হিসেবে পরিকল্পিত; publish owner পরে Bulk দিয়ে করবেন (Arch §১৭ P3c)।
import { countWords, docToText, makeExcerpt } from "../editorDoc";
import { fallbackSlug, slugify } from "../slug";
import { htmlToDoc } from "./html";

/** postRepo-র MAX_BODY_BYTES-এর অনুলিপি (lib data-মুক্ত; মান Arch §৬) */
export const MAX_BODY_BYTES = 900 * 1024;

export type WxrTerm = { slug: string; name: string };
export type WxrItem = {
  wpId: string;
  type: string;
  status: string;
  title: string;
  slug: string;
  dateGmt: string;
  link: string;
  content: string;
  categories: WxrTerm[];
  tags: WxrTerm[];
};
export type WxrFile = { siteTitle: string; siteUrl: string; items: WxrItem[] };

export type PlannedPost = {
  wpId: string;
  title: string;
  slug: string;
  sourceStatus: string;
  /** খ-তে লেখা হবে সবসময় status=draft + visibility=private, সোর্স-অবস্থা যা-ই হোক; publish শুধু owner (হাতে) */
  originalDate: Date | null;
  body: string;
  excerpt: string;
  wordCount: number;
  bodyBytes: number;
  categories: string[];
  tags: string[];
  images: string[];
  dropped: Record<string, number>;
  originalUrl: string;
  flags: { oversize: boolean; empty: boolean; slugConflict: boolean; trashResidue: boolean; noDate: boolean };
};

export type ImportSummary = {
  totalPosts: number;
  bySource: { publish: number; draft: number; private: number; other: number };
  skipped: { trash: number; otherTypes: Record<string, number> };
  pages: string[];
  categories: { name: string; count: number }[];
  tagCount: number;
  oversize: string[];
  conflicts: { slug: string; title: string; with: "existing" | "file" }[];
  images: { total: number; byHost: { host: string; count: number }[] };
  dropped: Record<string, number>;
  trashResidue: number;
  empty: number;
  noDate: number;
  words: number;
};

export type ImportPlan = { posts: PlannedPost[]; summary: ImportSummary };

/** WordPress-এর ভেতরের/মিডিয়া type — আমদানির বিষয় নয়, রিপোর্টে গোনা হয় না */
const SYSTEM_TYPES = new Set(["attachment", "nav_menu_item", "wp_global_styles", "wp_navigation"]);
const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;

/**
 * নতুন slug: শিরোনাম থেকে (WordPress নিজেই post_name ২০০ বাইটে কেটে দেয় — প্রায়ই শব্দের মাঝখানে); শিরোনাম খালি/
 * slug-অযোগ্য হলে মূল post_name (decode + `__trashed` বাদ), তাও না হলে wpId-ভিত্তিক। মূল লিংক `originalUrl`-এ থাকে।
 */
export function importSlug(rawName: string, title: string, wpId: string): string {
  let s = rawName;
  try {
    s = decodeURIComponent(rawName);
  } catch {
    /* কাঁচাই থাকুক */
  }
  s = s.replace(/__trashed(-\d+)?$/, "");
  return slugify(title) || slugify(s) || fallbackSlug(`wp${wpId}`);
}

/** 'YYYY-MM-DD HH:MM:SS' (UTC) → Date; শূন্য/অবৈধ → null */
export function parseWpDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(s.trim());
  if (!m || m[1] === "0000") return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export const hostOf = (src: string): string => /^https?:\/\/([^/?#]+)/i.exec(src)?.[1]?.toLowerCase() ?? "(অন্যান্য)";

const bump = (m: Map<string, number>, k: string, n = 1) => void m.set(k, (m.get(k) ?? 0) + n);

export function planImport(file: WxrFile, opts: { existingSlugs: ReadonlySet<string> }): ImportPlan {
  const posts: PlannedPost[] = [];
  const seen = new Set<string>();
  const cats = new Map<string, number>();
  const tags = new Set<string>();
  const hosts = new Map<string, number>();
  const dropped: Record<string, number> = {};
  const otherTypes: Record<string, number> = {};
  const pages: string[] = [];
  const summary: ImportSummary = {
    totalPosts: 0,
    bySource: { publish: 0, draft: 0, private: 0, other: 0 },
    skipped: { trash: 0, otherTypes },
    pages,
    categories: [],
    tagCount: 0,
    oversize: [],
    conflicts: [],
    images: { total: 0, byHost: [] },
    dropped,
    trashResidue: 0,
    empty: 0,
    noDate: 0,
    words: 0,
  };

  for (const it of file.items) {
    if (it.type !== "post") {
      if (it.type === "page" && it.status === "publish") pages.push(it.title);
      else if (!SYSTEM_TYPES.has(it.type) && it.type !== "page") otherTypes[it.type] = (otherTypes[it.type] ?? 0) + 1;
      continue;
    }
    if (it.status === "trash") {
      summary.skipped.trash++;
      continue;
    }
    const src = it.status === "publish" || it.status === "draft" || it.status === "private" ? it.status : "other";
    summary.bySource[src]++;

    const { doc, images, dropped: d } = htmlToDoc(it.content);
    const body = JSON.stringify(doc);
    const bodyBytes = utf8Bytes(body);
    const text = docToText(doc);
    const slug = importSlug(it.slug, it.title, it.wpId);
    const originalDate = parseWpDate(it.dateGmt);
    const conflictWith = opts.existingSlugs.has(slug) ? "existing" : seen.has(slug) ? "file" : null;
    seen.add(slug);
    const flags = {
      oversize: bodyBytes > MAX_BODY_BYTES,
      empty: text.trim() === "" && images.length === 0,
      slugConflict: conflictWith !== null,
      trashResidue: /__trashed/.test(it.slug),
      noDate: originalDate === null,
    };
    if (flags.oversize) summary.oversize.push(it.title);
    if (conflictWith) summary.conflicts.push({ slug, title: it.title, with: conflictWith });
    if (flags.trashResidue) summary.trashResidue++;
    if (flags.empty) summary.empty++;
    if (flags.noDate) summary.noDate++;
    for (const [k, n] of Object.entries(d)) dropped[k] = (dropped[k] ?? 0) + n;
    for (const s of images) bump(hosts, hostOf(s));
    for (const c of it.categories) bump(cats, c.name);
    for (const t of it.tags) tags.add(t.name);
    const wordCount = countWords(text);
    summary.words += wordCount;
    posts.push({
      wpId: it.wpId,
      title: it.title.trim(),
      slug,
      sourceStatus: it.status,
      originalDate,
      body,
      excerpt: makeExcerpt(text),
      wordCount,
      bodyBytes,
      categories: it.categories.map((c) => c.name),
      tags: it.tags.map((t) => t.name),
      images,
      dropped: d,
      originalUrl: it.link,
      flags,
    });
  }

  summary.totalPosts = posts.length;
  summary.tagCount = tags.size;
  summary.categories = [...cats].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  summary.images = {
    total: [...hosts.values()].reduce((s, n) => s + n, 0),
    byHost: [...hosts].map(([host, count]) => ({ host, count })).sort((a, b) => b.count - a.count),
  };
  return { posts, summary };
}
