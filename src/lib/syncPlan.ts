// Firestore sync-এর pure নিয়ম (Arch §১২ autosave নীতি-খ/ঙ): সময়-হিসাব ও conflict-যাচাই। SDK/UI-মুক্ত।
export const IDLE_MS = 5_000; // শেষ টাইপের পর অন্তত এতক্ষণ থামলে sync
export const MIN_INTERVAL_MS = 15_000; // দুই sync-এর ন্যূনতম ব্যবধান (quota সাশ্রয়)
export const RETRY_MS = 30_000; // ব্যর্থ হলে আবার চেষ্টা

export type SyncReason = "idle" | "blur" | "manual";

/** কত ms পরে sync চালাতে হবে। manual = সাথে সাথে; blur = শুধু ন্যূনতম ব্যবধান মানা; idle = থামা + ব্যবধান দুটোই */
export function syncDelay(
  reason: SyncReason,
  now: number,
  lastEditAt: number,
  lastSyncAt: number,
): number {
  if (reason === "manual") return 0;
  const minAt = lastSyncAt + MIN_INTERVAL_MS;
  const at = reason === "blur" ? minAt : Math.max(lastEditAt + IDLE_MS, minAt);
  return Math.max(0, at - now);
}

/**
 * রিমোট ডক কি আমার শেষ-দেখার পর অন্য কেউ বদলেছে? (merge-logic নেই — শুধু সতর্কতা, Arch §১২-ঙ)
 * base থাকলে `!==` (ঘড়ির পার্থক্যে নিরাপদ: নিজের লেখা base-এ বসে); না থাকলে রিমোট লোকালের শেষ সম্পাদনার পরে হলে true।
 */
export function remoteChanged(remoteMs: number, baseMs: number | undefined, localUpdatedMs: number): boolean {
  return baseMs === undefined ? remoteMs > localUpdatedMs : remoteMs !== baseMs;
}

export type Content = { title: string; body: string; excerpt: string };
export const sameContent = (a: Content, b: Content): boolean =>
  a.title === b.title && a.body === b.body && a.excerpt === b.excerpt;
