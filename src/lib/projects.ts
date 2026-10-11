// Writing Project ও Chapter-এর pure সহায়ক (SDK/UI-মুক্ত; P14a-১, Arch §৬ `writingProjects`/`chapters`):
// slug-সংঘাত, ক্রম-বদল (idempotent পরিকল্পনা), progress ও শব্দ-গণনা, পাবলিক পথ।
import { countWords } from "./editorDoc";
import { slugify, withSuffix } from "./slug";

export const PROJECT_SCHEMA_VERSION = 1;
export const CHAPTER_SCHEMA_VERSION = 1;
export const PROJECT_TITLE_MAX = 120;
export const PROJECT_DESC_MAX = 500;
export const CHAPTER_TITLE_MAX = 120;
/** একটা প্রজেক্টের অধ্যায়-সংখ্যার সীমা: ক্রম-বদলের writeBatch (≤৫০০ লেখা) ও তালিকা-পড়ার খরচ নিরাপদ রাখতে */
export const MAX_CHAPTERS_PER_PROJECT = 200;
export const MAX_SLUG_ATTEMPTS = 50;

export const projectFallbackSlug = (id: string): string => `project-${id.slice(0, 8).toLowerCase()}`;
export const chapterFallbackSlug = (id: string): string => `chapter-${id.slice(0, 8).toLowerCase()}`;

/** শিরোনাম থেকে slug; না বানানো গেলে (খালি/শুধু চিহ্ন) id-ভিত্তিক */
export const projectSlugBase = (title: string, id: string): string => slugify(title) || projectFallbackSlug(id);
export const chapterSlugBase = (title: string, id: string): string => slugify(title) || chapterFallbackSlug(id);

/** `taken` (বিদ্যমান slug-এর সেট, নিজেরটা বাদে) এড়িয়ে প্রথম খালি slug; না পেলে null */
export function pickFreeSlug(base: string, taken: ReadonlySet<string>): string | null {
  for (let n = 1; n <= MAX_SLUG_ATTEMPTS; n++) {
    const cand = withSuffix(base, n);
    if (!taken.has(cand)) return cand;
  }
  return null;
}

/** ক্রমে বসানোর minimal ক্ষেত্র — repo-র `Chapter` এর সাথে structurally সঙ্গতিপূর্ণ */
export type OrderedItem = { id: string; order: number };

/** `order` ছোট আগে; সমান হলে id-ক্রমে (নির্ধারিত ফল — tie-তে লাফালাফি নেই) */
export const sortByOrder = <T extends OrderedItem>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** নতুন অধ্যায়ের order = বিদ্যমান সর্বোচ্চ + ১ (ট্র্যাশ-করা সহ — পুনরুদ্ধারে ক্রম না ভাঙতে); খালি হলে ০ */
export const nextOrder = (items: readonly OrderedItem[]): number =>
  items.length === 0 ? 0 : Math.max(...items.map((i) => i.order)) + 1;

/** ↑/↓: ids-এর `id`-কে এক ধাপ সরানো ক্রম; প্রান্তে/অজানা id-তে অপরিবর্তিত (UI এই ফল `reorder`-এ দেয়) */
export function moveId(ids: readonly string[], id: string, dir: "up" | "down"): string[] {
  const i = ids.indexOf(id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return [...ids];
  const out = [...ids];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export type OrderPatch = { id: string; order: number };
export type ReorderPlan = { ok: true; patches: OrderPatch[] } | { ok: false; reason: "mismatch" | "duplicate-ids" };

/**
 * `current` (ট্র্যাশ বাদে) → `desiredIds` ক্রমে বসানোর minimal patch।
 * idempotent: একই desiredIds-এ দ্বিতীয়বার চালালে patch খালি। বিদ্যমান order-গুলো সব আলাদা হলে শুধু সেগুলোই
 * নতুন ক্রমে বিলি হয় (পাশাপাশি অদলবদলে ঠিক ২টা patch); কোনো tie থাকলে ০..n-১ পুনর্নম্বর।
 * `desiredIds` বর্তমান সেটের permutation না হলে (তালিকা ইতোমধ্যে বদলে গেছে) ব্যর্থ — UI রিফ্রেশ করবে।
 */
export function planReorder(current: readonly OrderedItem[], desiredIds: readonly string[]): ReorderPlan {
  if (new Set(desiredIds).size !== desiredIds.length) return { ok: false, reason: "duplicate-ids" };
  const cur = new Map(current.map((c) => [c.id, c.order]));
  if (cur.size !== desiredIds.length || desiredIds.some((id) => !cur.has(id))) return { ok: false, reason: "mismatch" };
  const sortedOrders = [...cur.values()].sort((a, b) => a - b);
  const hasTie = sortedOrders.some((o, i) => i > 0 && o === sortedOrders[i - 1]);
  const target = hasTie ? desiredIds.map((_, i) => i) : sortedOrders;
  const patches: OrderPatch[] = [];
  desiredIds.forEach((id, i) => {
    if (cur.get(id) !== target[i]) patches.push({ id, order: target[i] });
  });
  return { ok: true, patches };
}

export type ChapterLite = { status: string; wordCount: number };
export type ProjectProgress = {
  /** ট্র্যাশ বাদে মোট অধ্যায় */
  chapters: number;
  published: number;
  /** ট্র্যাশ বাদে সব অধ্যায়ের শব্দ-যোগফল */
  words: number;
  /** `targetWords` থাকলে ০–১০০ (পূর্ণসংখ্যা, ১০০-তে সীমিত); না থাকলে null */
  percent: number | null;
};

export function projectProgress(chapters: readonly ChapterLite[], targetWords?: number | null): ProjectProgress {
  const live = chapters.filter((c) => c.status !== "trashed");
  const words = live.reduce((s, c) => s + Math.max(0, c.wordCount), 0);
  const percent = targetWords && targetWords > 0 ? Math.min(100, Math.floor((words / targetWords) * 100)) : null;
  return { chapters: live.length, published: live.filter((c) => c.status === "published").length, words, percent };
}

/** সাধারণ-লেখা থেকে শব্দ (editor-এর `countWords` reuse) */
export const chapterWordCount = (plainText: string): number => countWords(plainText);

/** Book Mode: `/book/<প্রজেক্ট>` — `/works/<p>/<x>`-এ নয়, কারণ অধ্যায়-slug-এর সাথে সংঘাত হতো (P14c-২) */
export const bookPath = (projectSlug: string): string => `/book/${encodeURIComponent(projectSlug)}`;

/** পাবলিক পথ `/works/<প্রজেক্ট>[/<অধ্যায়>]` (বাংলা slug percent-encode) */
export const worksPath = (projectSlug?: string, chapterSlug?: string): string =>
  ["/works", projectSlug, projectSlug ? chapterSlug : undefined]
    .filter((x): x is string => Boolean(x))
    .map((x, i) => (i === 0 ? x : encodeURIComponent(x)))
    .join("/");
