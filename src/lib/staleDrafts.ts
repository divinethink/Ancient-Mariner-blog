// 'অসমাপ্ত লেখা' মনে-করানো (দিনলিপি-ঙ): pure (SDK/UI-মুক্ত)। শুধু নিজের শুরু-করা খসড়া — দিনলিপি, WordPress-ইমপোর্ট ও ফাঁকা (০ শব্দ) খসড়া বাদ।
// চাপ নেই: 'এখন নয়' চাপলে ৭ দিন লুকানো (প্রতি-ডিভাইস)। 
export const STALE_DAYS = 30;
export const SNOOZE_DAYS = 7;
export const STALE_LIST_MAX = 50;
const DAY_MS = 86_400_000;

export const staleCutoff = (now: number): number => now - STALE_DAYS * DAY_MS;

type DraftLike = {
  id: string;
  status: string;
  contentType: string;
  wordCount: number;
  updatedAt: Date;
  importSource?: unknown;
};

/** সবচেয়ে সাম্প্রতিক-সম্পাদিত যোগ্য অসমাপ্ত খসড়া (নেই ⇒ undefined) */
export function pickStaleDraft<T extends DraftLike>(drafts: readonly T[], now: number): T | undefined {
  const cutoff = staleCutoff(now);
  return drafts
    .filter((d) => d.status === "draft" && d.contentType !== "diary" && !d.importSource && d.wordCount >= 1 && d.updatedAt.getTime() <= cutoff)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
}

export const daysSince = (d: Date, now: number): number => Math.max(0, Math.floor((now - d.getTime()) / DAY_MS));

/** 'এখন নয়' চাপার পর এখনো লুকানো কি (snoozedAt = চাপার মুহূর্ত, ms) */
export const isSnoozed = (snoozedAt: unknown, now: number): boolean =>
  typeof snoozedAt === "number" && Number.isFinite(snoozedAt) && now - snoozedAt < SNOOZE_DAYS * DAY_MS;
