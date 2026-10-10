// view-গণনার D1 অ্যাক্সেস — D1-এ হাত দেওয়ার একমাত্র জায়গা (Arch §৭; পথ গ)। Firestore-এর সাথে সম্পর্ক নেই।
// সব SQL parameterized; ব্যর্থতা কলারে throw হয় (route পাঠককে কখনো error দেখায় না)।
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { fillBuckets, toCount, type Point, type StatsWindow } from "@/lib/stats";
import { MAX_POSTS_PER_VISITOR_PER_DAY } from "@/lib/views";

/** `D1Database`-এর যতটুকু লাগে (workers-types dependency ছাড়া; unit-test-এ SQLite adapter) */
export interface D1Like {
  prepare(sql: string): {
    bind(...v: unknown[]): {
      run(): Promise<{ meta?: { changes?: number } }>;
      all(): Promise<{ results?: Record<string, unknown>[] }>;
    };
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

/**
 * fixed-window limiter (মন্তব্য; P11b-১): `key`-এ উইন্ডো মিশানো (PK একক), `windowStart` = দিন (Cron cleanup-এর জন্য)।
 * atomic: প্রথম ব্যবহারে INSERT; পরেরগুলোয় `n < max` থাকলেই +১। সীমা ছুঁলে false (row অপরিবর্তিত)।
 */
export async function consumeLimit(db: D1Like, key: string, windowStart: string, max: number): Promise<boolean> {
  const ins = await db.prepare("INSERT OR IGNORE INTO rateLimits (key, windowStart, n) VALUES (?, ?, 1)").bind(key, windowStart).run();
  if (changes(ins) === 1) return max >= 1;
  const bump = await db.prepare("UPDATE rateLimits SET n = n + 1 WHERE key = ? AND n < ?").bind(key, max).run();
  return changes(bump) === 1;
}

/** dedupe row-এর পরিষ্কার (Cron): `keepFromDay`-এর (YYYY-MM-DD) আগের row মোছে; `viewCounts`/`dailyVisitors` কখনো মোছা হয় না */
export async function cleanupRateLimits(db: D1Like, keepFromDay: string, limit = 5000): Promise<number> {
  const r = await db
    .prepare("DELETE FROM rateLimits WHERE key IN (SELECT key FROM rateLimits WHERE windowStart < ? LIMIT ?)")
    .bind(keepFromDay, limit)
    .run();
  return changes(r);
}

export type StatsData = {
  views: number;
  visitors: number;
  prevViews: number | null;
  prevVisitors: number | null;
  /** দিনভিত্তিক (বা মাসভিত্তিক) ভিউ — ফাঁকা দিন/মাস ০ দিয়ে ভরা */
  series: Point[];
  posts: { postId: string; n: number }[];
  referrers: Point[];
  countries: Point[];
};

/** তালিকা-সীমা: UI শীর্ষ ~১০টা দেখায়, [সব দেখুন]-এ এই কয়টা পর্যন্ত */
export const STATS_LIST_LIMIT = 30;

/**
 * পরিসংখ্যান পড়া (owner-only route থেকে; শুধু SELECT, aggregation-এ LIMIT নেই — মোট/চার্ট কখনো truncate হয় না, শুধু তালিকা-র্যাংক ছাঁটা)।
 * ভিজিটর = দিনের আনুমানিক ভিজিটরের যোগফল (একই মানুষ ভিন্ন দিনে দুইবার গণ্য — 'আনুমানিক')।
 */
export async function readStats(db: D1Like, w: StatsWindow): Promise<StatsData> {
  const q = async (sql: string, ...bind: unknown[]) => (await db.prepare(sql).bind(...bind).all()).results ?? [];
  const sum = async (table: "viewCounts" | "dailyVisitors", from: string, to: string) =>
    toCount((await q(`SELECT COALESCE(SUM(n), 0) AS n FROM ${table} WHERE day BETWEEN ? AND ?`, from, to))[0]?.n);
  const keyExpr = w.bucket === "month" ? "substr(day, 1, 7)" : "day";
  const top = async (col: "postId" | "referrer" | "country") =>
    q(`SELECT ${col} AS k, SUM(n) AS n FROM viewCounts WHERE day BETWEEN ? AND ? GROUP BY ${col} ORDER BY n DESC, k ASC LIMIT ?`, w.from, w.to, STATS_LIST_LIMIT);
  const pts = (rows: Record<string, unknown>[]): Point[] => rows.map((r) => ({ k: String(r.k), n: toCount(r.n) })).filter((p) => p.n > 0);

  const [views, visitors, prevViews, prevVisitors, seriesRows, posts, referrers, countries] = await Promise.all([
    sum("viewCounts", w.from, w.to),
    sum("dailyVisitors", w.from, w.to),
    w.prev ? sum("viewCounts", w.prev.from, w.prev.to) : Promise.resolve(null),
    w.prev ? sum("dailyVisitors", w.prev.from, w.prev.to) : Promise.resolve(null),
    q(`SELECT ${keyExpr} AS k, SUM(n) AS n FROM viewCounts WHERE day BETWEEN ? AND ? GROUP BY k`, w.from, w.to),
    top("postId"),
    top("referrer"),
    top("country"),
  ]);
  return {
    views,
    visitors,
    prevViews,
    prevVisitors,
    series: fillBuckets(pts(seriesRows), w),
    posts: pts(posts).map((p) => ({ postId: p.k, n: p.n })),
    referrers: pts(referrers),
    countries: pts(countries),
  };
}
