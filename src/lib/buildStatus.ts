// পাবলিক সাইট হালনাগাদ-অবস্থা (Arch §১২): `/build.json`-এর builtAt বনাম owner-এর শেষ সাইট-বদলানো ক্রিয়ার সময়। pure।
export const STALE_AFTER_MS = 5 * 60 * 1000;

export type BuildState =
  | "unknown" // build.json পড়া যায়নি
  | "ok" // শেষ ক্রিয়ার পরে build হয়েছে (বা ক্রিয়া নেই)
  | "pending" // ক্রিয়ার পর ৫ মিনিটের ভেতর — অপেক্ষা
  | "stale"; // ৫ মিনিট পার, তবু build আসেনি

export function buildState(i: { builtAt: number | null; changedAt?: number; now: number }): BuildState {
  if (i.builtAt === null) return "unknown";
  if (i.changedAt === undefined || i.changedAt <= i.builtAt) return "ok";
  return i.now - i.changedAt > STALE_AFTER_MS ? "stale" : "pending";
}
