// সম্পর্কিত লেখা ও আগের/পরের লেখা (Arch §১৭ P10a-৩) — build-ডেটা (`publishedAt desc`) থেকে মেমরিতে; নতুন query নেই। pure।
export type RelPost = { id: string; categoryId?: string };

/** একই categoryId, বর্তমান লেখা বাদ, ইনপুট-ক্রমে (নতুন আগে), সর্বোচ্চ `limit` (ডিফল্ট ২); category না থাকলে খালি */
export function relatedIds(posts: readonly RelPost[], id: string, limit = 2): string[] {
  const cur = posts.find((p) => p.id === id);
  if (!cur?.categoryId) return [];
  return posts.filter((p) => p.id !== id && p.categoryId === cur.categoryId).slice(0, limit).map((p) => p.id);
}

/** older = আগের (পুরনো) লেখা, newer = পরের (নতুন) লেখা; সংশ্লিষ্ট দিকে না থাকলে undefined */
export function adjacentIds(posts: readonly { id: string }[], id: string): { older?: string; newer?: string } {
  const i = posts.findIndex((p) => p.id === id);
  if (i < 0) return {};
  const older = posts[i + 1]?.id;
  const newer = posts[i - 1]?.id;
  return { ...(older && { older }), ...(newer && { newer }) };
}

/** সিরিজের (পর্ব-ক্রমে সাজানো) তালিকায় id-এর অবস্থান: index (০-ভিত্তিক), total, আগের/পরের পর্ব; না পেলে null */
export function seriesPosition<T extends { id: string }>(items: readonly T[], id: string): { index: number; total: number; prev?: T; next?: T } | null {
  const index = items.findIndex((x) => x.id === id);
  if (index < 0) return null;
  const prev = items[index - 1];
  const next = items[index + 1];
  return { index, total: items.length, ...(prev && { prev }), ...(next && { next }) };
}
