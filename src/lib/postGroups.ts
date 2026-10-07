// build-ডেটা (published+public পোস্ট, `publishedAt desc`) থেকে category/tag/series গ্রুপ — মেমরিতে, আলাদা query/index নেই
// (Arch §২, §১৭ P4a)। pure, SDK/UI-মুক্ত। ইনপুটের ক্রম অপরিবর্তিত থাকে (series বাদে)।
export type GroupPost = {
  categoryId?: string;
  tagIds: readonly string[];
  seriesId?: string;
  seriesOrder?: number;
};

/** শীর্ষ category-পেজে সন্তান-category-র লেখাও আসে (`childIds`); এক লেখা একবারই */
export function byCategory<T extends GroupPost>(posts: readonly T[], categoryId: string, childIds: readonly string[] = []): T[] {
  const ids = new Set([categoryId, ...childIds]);
  return posts.filter((p) => p.categoryId !== undefined && ids.has(p.categoryId));
}

export const byTag = <T extends GroupPost>(posts: readonly T[], tagId: string): T[] =>
  posts.filter((p) => p.tagIds.includes(tagId));

/** series: `seriesOrder asc`; order না থাকলে শেষে; সমান হলে মূল ক্রম (stable) */
export function bySeries<T extends GroupPost>(posts: readonly T[], seriesId: string): T[] {
  return posts
    .filter((p) => p.seriesId === seriesId)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.seriesOrder ?? Infinity) - (b.p.seriesOrder ?? Infinity) || a.i - b.i)
    .map((x) => x.p);
}
