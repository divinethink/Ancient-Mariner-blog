// পাবলিক `/works`-এর pure যুক্তি (SDK/UI-মুক্ত; P14c-১): published+public ছাঁকা, অধ্যায়-ক্রম, আগের/পরের, সংক্ষেপ।
// ডেটা-স্তর (`worksRepo.server`) আগেই ছাঁকে; এখানে আবার ছাঁকা (defense-in-depth) ও slug-সংঘাত (অনন্যতা ভাঙলেও build যেন না ভাঙে)।
import { docToText, makeExcerpt, parseBody } from "./editorDoc";
import { sortByOrder, worksPath } from "./projects";
import type { FeedPost } from "./rss";

export type WorkProjectIn = {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: string;
  status: string;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
};
export type WorkChapterIn = {
  id: string;
  projectId: string;
  slug: string;
  title: string;
  body: string;
  wordCount: number;
  order: number;
  status: string;
  visibility: string;
  updatedAt: Date;
  publishedAt?: Date;
};
export type Work<P extends WorkProjectIn = WorkProjectIn, C extends WorkChapterIn = WorkChapterIn> = { project: P; chapters: C[] };

const live = (x: { status: string; visibility: string }) => x.status === "published" && x.visibility === "public";

/** প্রজেক্ট: নতুন-হালনাগাদ আগে; অধ্যায়: `order` ক্রমে। সংঘাতে (একই slug) প্রথমটা রাখে — বাকিরা বাদ */
export function buildWorks<P extends WorkProjectIn, C extends WorkChapterIn>(projects: readonly P[], chapters: readonly C[]): Work<P, C>[] {
  const seen = new Set<string>();
  const ps = projects
    .filter(live)
    .slice()
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.id.localeCompare(b.id))
    .filter((p) => (seen.has(p.slug) ? false : (seen.add(p.slug), true)));
  return ps.map((project) => {
    const slugs = new Set<string>();
    const own = sortByOrder(chapters.filter((c) => c.projectId === project.id && live(c))).filter((c) =>
      slugs.has(c.slug) ? false : (slugs.add(c.slug), true),
    );
    return { project, chapters: own };
  });
}

export type Neighbors<C> = { index: number; total: number; prev?: C; next?: C };

/** অধ্যায়ের ক্রমে আগের/পরের; না পেলে null */
export function chapterNeighbors<C extends { id: string }>(chapters: readonly C[], id: string): Neighbors<C> | null {
  const index = chapters.findIndex((c) => c.id === id);
  if (index < 0) return null;
  return { index, total: chapters.length, prev: chapters[index - 1], next: chapters[index + 1] };
}

/** প্রজেক্টের মোট শব্দ (শুধু দৃশ্যমান অধ্যায়) */
export const worksWordTotal = (chapters: readonly { wordCount: number }[]): number => chapters.reduce((s, c) => s + c.wordCount, 0);

/** SEO/তালিকার সংক্ষেপ: প্রজেক্টে `description`, না থাকলে খালি; অধ্যায়ে লেখার শুরু */
export const chapterExcerpt = (body: string): string => makeExcerpt(docToText(parseBody(body)));
export const projectExcerpt = (description: string): string => makeExcerpt(description);

// ── সাইটে দৃশ্যমান বদল কি? (rebuild-ট্রিগারের সিদ্ধান্ত; P14c-২) ──────────────────────────────────

type Vis = { status: string; visibility: string };
/** প্রজেক্ট/অধ্যায় সাইটে দেখা যায় = published + public */
export const isLive = (x: Vis): boolean => x.status === "published" && x.visibility === "public";

/** প্রজেক্টের বদল সাইটে প্রভাব ফেলে কি (before/after = null মানে নেই/মোছা)। শুধু private-সীমার ভেতরের বদলে false */
export function projectAffectsSite(
  before: (Vis & { title: string; description: string; type: string }) | null,
  after: (Vis & { title: string; description: string; type: string }) | null,
): boolean {
  const b = !!before && isLive(before);
  const a = !!after && isLive(after);
  if (!b && !a) return false;
  if (b !== a || !before || !after) return true;
  return before.title !== after.title || before.description !== after.description || before.type !== after.type;
}

/** অধ্যায়ের বদল সাইটে প্রভাব ফেলে কি: প্রজেক্ট দৃশ্যমান না হলে কখনো না; অধ্যায় আগে/পরে কোনোটায় দৃশ্যমান না হলে না */
export function chapterAffectsSite(
  project: Vis | null,
  before: (Vis & { title: string; body: string; slug: string; order: number }) | null,
  after: (Vis & { title: string; body: string; slug: string; order: number }) | null,
): boolean {
  if (!project || !isLive(project)) return false;
  const b = !!before && isLive(before);
  const a = !!after && isLive(after);
  if (!b && !a) return false;
  if (b !== a || !before || !after) return true;
  return before.title !== after.title || before.body !== after.body || before.slug !== after.slug || before.order !== after.order;
}

/** ↑↓-এ পাবলিক ক্রম বদলাল কি: প্রজেক্ট দৃশ্যমান এবং দৃশ্যমান অধ্যায়ের আপেক্ষিক ক্রম আলাদা (private অধ্যায় সরালে false) */
export function visibleOrderChanged(
  project: Vis | null,
  before: readonly (OrderedId & Vis)[],
  after: readonly (OrderedId & Vis)[],
): boolean {
  if (!project || !isLive(project)) return false;
  const ids = (xs: readonly (OrderedId & Vis)[]) => sortByOrder(xs.filter(isLive)).map((x) => x.id).join("\u0000");
  return ids(before) !== ids(after);
}
type OrderedId = { id: string; order: number };

// ── RSS (অধ্যায় সাধারণ feed-এ; P14c-২) ──────────────────────────────────────────────────────────

/** দৃশ্যমান অধ্যায় → feed-আইটেম: শিরোনাম "প্রজেক্ট — অধ্যায়", লিংক `/works/…`; তারিখ-ক্রম মেলানো `mergeFeed`-এ */
export function chapterFeedItems(works: readonly Work[]): FeedPost[] {
  return works.flatMap((w) =>
    w.chapters.map((c) => ({
      slug: c.slug,
      path: worksPath(w.project.slug, c.slug),
      title: `${w.project.title} — ${c.title}`,
      excerpt: "",
      body: c.body,
      publishedAt: c.publishedAt,
      updatedAt: c.updatedAt,
    })),
  );
}

const when = (p: FeedPost): number => (p.publishedAt ?? p.updatedAt).getTime() || 0;
/** দুই তালিকা মিশিয়ে নতুন-আগে (সমান হলে আগের তালিকার আইটেম আগে — স্থিতিশীল) */
export const mergeFeed = (a: readonly FeedPost[], b: readonly FeedPost[]): FeedPost[] =>
  [...a, ...b].map((p, i) => ({ p, i })).sort((x, y) => when(y.p) - when(x.p) || x.i - y.i).map((x) => x.p);
