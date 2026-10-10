// 'পঠিত' (Popular) widget-এর বাছাই (P11a-২) — pure, SDK/UI-মুক্ত। D1-র ভিউ-সারি থেকে শুধু এখনো-published লেখা, সর্বোচ্চ `limit`টা।
export type PopularRow = { postId: string; n: number };

export const POPULAR_DAYS = 30;
export const POPULAR_LIMIT = 5;

/** D1 সারি (যেকোনো ক্রমে/বিকৃত হতে পারে) → ভিউ-সংখ্যা কমে; সমান হলে postId-ক্রমে (build-এ ক্রম স্থির); মোছা/অ-published বাদ */
export function pickPopular(rows: readonly unknown[], publishedIds: ReadonlySet<string>, limit = POPULAR_LIMIT): PopularRow[] {
  const sums = new Map<string, number>();
  for (const r of rows) {
    if (typeof r !== "object" || r === null) continue;
    const { postId, n } = r as Record<string, unknown>;
    const num = Number(n);
    if (typeof postId !== "string" || !publishedIds.has(postId) || !Number.isFinite(num) || num <= 0) continue;
    sums.set(postId, (sums.get(postId) ?? 0) + Math.floor(num));
  }
  return [...sums]
    .map(([postId, n]) => ({ postId, n }))
    .sort((a, b) => b.n - a.n || a.postId.localeCompare(b.postId))
    .slice(0, Math.max(0, limit));
}
