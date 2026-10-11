// পাবলিক `/works`-এর pure যুক্তি (SDK/UI-মুক্ত; P14c-১): published+public ছাঁকা, অধ্যায়-ক্রম, আগের/পরের, সংক্ষেপ।
// ডেটা-স্তর (`worksRepo.server`) আগেই ছাঁকে; এখানে আবার ছাঁকা (defense-in-depth) ও slug-সংঘাত (অনন্যতা ভাঙলেও build যেন না ভাঙে)।
import { docToText, makeExcerpt, parseBody } from "./editorDoc";
import { sortByOrder } from "./projects";

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
