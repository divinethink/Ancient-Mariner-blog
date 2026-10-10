// পাবলিক তালিকা-scope: /blog, category, tag, series (Arch §১৭ P4a)। build-ডেটা (published+public, publishedAt desc) থেকে
// মেমরিতে গ্রুপ — আলাদা query/index নেই। pure, SDK/UI-মুক্ত। যে term-এ লেখা নেই তার পেজ হয় না।
import { archivePath, archiveScopeKey, groupByMonth } from "./archive";
import { formatMonthYear } from "./datetime";
import { toCardView, type CardMedia, type CardPost, type CardTerm, type CardView, type CardCtx } from "./cards";
import { byCategory, bySeries, byTag, type GroupPost } from "./postGroups";
import { BLOG_INDEX_PATH, categoryPath, seriesPath, tagPath } from "./publicSite";

export type ScopeKind = "blog" | "category" | "tag" | "series" | "archive";
export type ScopeTerm = CardTerm & { name: string; description: string; parentCategoryId?: string };
export type Scope = {
  /** chunk-ফাইলের নাম-ভিত্তি; blog = "blog", বাকি `c-/t-/s-<id>` */
  key: string;
  kind: ScopeKind;
  term?: ScopeTerm;
  /** শুধু সন্তান-category: parent (breadcrumb) */
  parent?: ScopeTerm;
  /** শুধু archive: মাস ও লেবেল ("সেপ্টেম্বর ২০২৬") */
  month?: { y: number; m: number };
  label?: string;
  /** পাবলিক পেজের পথ (percent-encoded) */
  path: string;
  cards: CardView[];
};
export type ListPost = CardPost & GroupPost;
export type ListTerms = { categories: readonly ScopeTerm[]; tags: readonly ScopeTerm[]; series: readonly ScopeTerm[] };

const byName = (a: ScopeTerm, b: ScopeTerm) => a.name.localeCompare(b.name, "bn");

export function buildScopes(input: {
  posts: readonly ListPost[];
  terms: ListTerms;
  timeZone: string;
  media?: ReadonlyMap<string, CardMedia>;
}): Scope[] {
  const { posts, terms, timeZone, media } = input;
  const idMap = (ts: readonly ScopeTerm[]) => new Map(ts.map((t) => [t.id, t] as const));
  const ctx: CardCtx = { timeZone, categories: idMap(terms.categories), tags: idMap(terms.tags), media };
  const view = (ps: readonly ListPost[]) => ps.map((p) => toCardView(p, ctx));

  const scopes: Scope[] = [{ key: "blog", kind: "blog", path: BLOG_INDEX_PATH, cards: view(posts) }];

  const catById = idMap(terms.categories);
  for (const c of [...terms.categories].sort(byName)) {
    const childIds = terms.categories.filter((x) => x.parentCategoryId === c.id).map((x) => x.id);
    const ps = byCategory(posts, c.id, childIds);
    if (ps.length === 0) continue;
    const parent = c.parentCategoryId ? catById.get(c.parentCategoryId) : undefined;
    scopes.push({ key: `c-${c.id}`, kind: "category", term: c, ...(parent && { parent }), path: categoryPath(c.slug), cards: view(ps) });
  }
  for (const t of [...terms.tags].sort(byName)) {
    const ps = byTag(posts, t.id);
    if (ps.length) scopes.push({ key: `t-${t.id}`, kind: "tag", term: t, path: tagPath(t.slug), cards: view(ps) });
  }
  for (const s of [...terms.series].sort(byName)) {
    const ps = bySeries(posts, s.id);
    if (ps.length) scopes.push({ key: `s-${s.id}`, kind: "series", term: s, path: seriesPath(s.slug), cards: view(ps) });
  }
  // P10a-৩: মাসভিত্তিক archive (blog-এর card থেকে; `publishedAt` সাইট-timezone-এ গ্রুপ; নতুন মাস আগে)
  const groups = [...groupByMonth(scopes[0].cards, timeZone).values()].sort((a, b) => b.y - a.y || b.m - a.m);
  for (const g of groups) {
    scopes.push({ key: archiveScopeKey(g.y, g.m), kind: "archive", month: { y: g.y, m: g.m }, label: formatMonthYear(g.y, g.m), path: archivePath(g.y, g.m), cards: g.items });
  }
  return scopes;
}
