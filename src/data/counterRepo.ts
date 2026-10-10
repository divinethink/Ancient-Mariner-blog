// view-গণনার D1 অ্যাক্সেস — D1-এ হাত দেওয়ার একমাত্র জায়গা (Arch §৭; পথ গ)। Firestore-এর সাথে সম্পর্ক নেই।
// সব SQL parameterized; ব্যর্থতা কলারে throw হয় (route পাঠককে কখনো error দেখায় না)।
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { MAX_POSTS_PER_VISITOR_PER_DAY } from "@/lib/views";

/** `D1Database`-এর যতটুকু লাগে (workers-types dependency ছাড়া; unit-test-এ SQLite adapter) */
export interface D1Like {
  prepare(sql: string): {
    bind(...v: unknown[]): { run(): Promise<{ meta?: { changes?: number } }> };
  };
}

/** Worker-এর `DB` binding; না থাকলে null (গণনা নীরবে বন্ধ — পাঠকের পেজ অক্ষত) */
export function getCounterDb(): D1Like | null {
  try {
    const db = (getCloudflareContext().env as { DB?: D1Like }).DB;
    return db ?? null;
  } catch {
    return null;
  }
}

const changes = (r: { meta?: { changes?: number } }): number => r.meta?.changes ?? 0;

export type ViewInput = {
  postId: string;
  day: string;
  country: string;
  referrer: string;
  visitorKey: string; // 'v:<h>'
  postKey: string; // 'p:<postId>:<h>'
};
export type ViewResult = "counted" | "duplicate" | "limited";

/**
 * একটা ভিউ গোনা। idempotent: একই (ভিজিটর, পোস্ট, দিন) আবার এলে `duplicate` (কিছুই বাড়ে না)।
 * প্রতি নতুন ভিউয়ে ≤ ~৪ row-লেখা (Arch §৭ D1 হিসাব)।
 */
export async function recordView(db: D1Like, v: ViewInput): Promise<ViewResult> {
  // ১) পোস্ট×ভিজিটর key — আগে থেকে থাকলে duplicate
  const p = await db.prepare("INSERT OR IGNORE INTO rateLimits (key, windowStart, n) VALUES (?, ?, 1)").bind(v.postKey, v.day).run();
  if (changes(p) === 0) return "duplicate";
  // ২) ভিজিটর key — নতুন হলে dailyVisitors +১; থাকলে স্প্যাম-সীমা (দিনে সর্বোচ্চ N ভিন্ন পোস্ট)
  const vis = await db.prepare("INSERT OR IGNORE INTO rateLimits (key, windowStart, n) VALUES (?, ?, 1)").bind(v.visitorKey, v.day).run();
  if (changes(vis) === 1) {
    await db.prepare("INSERT INTO dailyVisitors (day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1").bind(v.day).run();
  } else {
    const bump = await db.prepare("UPDATE rateLimits SET n = n + 1 WHERE key = ? AND n < ?").bind(v.visitorKey, MAX_POSTS_PER_VISITOR_PER_DAY).run();
    if (changes(bump) === 0) return "limited";
  }
  // ৩) পোস্ট-ভিউ
  await db
    .prepare("INSERT INTO viewCounts (postId, day, country, referrer, n) VALUES (?, ?, ?, ?, 1) ON CONFLICT(postId, day, country, referrer) DO UPDATE SET n = n + 1")
    .bind(v.postId, v.day, v.country, v.referrer)
    .run();
  return "counted";
}

/** dedupe row-এর পরিষ্কার (Cron): `keepFromDay`-এর (YYYY-MM-DD) আগের row মোছে; `viewCounts`/`dailyVisitors` কখনো মোছা হয় না */
export async function cleanupRateLimits(db: D1Like, keepFromDay: string, limit = 5000): Promise<number> {
  const r = await db
    .prepare("DELETE FROM rateLimits WHERE key IN (SELECT key FROM rateLimits WHERE windowStart < ? LIMIT ?)")
    .bind(keepFromDay, limit)
    .run();
  return changes(r);
}
