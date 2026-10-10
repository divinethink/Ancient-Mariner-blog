// পরিসংখ্যানের pure যুক্তি (P11a-২; Arch §১৭ P11a, Mockup §৭.২৭) — SDK/UI-মুক্ত।
// 'দিন' = সাইট-timezone-এর "YYYY-MM-DD" (D1 `viewCounts.day`-এর মতোই, `lib/datetime.ts`); দিন-গণনা calendar-arithmetic, UTC-substring নয়।
import { dayKey, formatMonthYear } from "./datetime";

export const STATS_RANGES = ["today", "7d", "30d", "12m", "all"] as const;
export type StatsRange = (typeof STATS_RANGES)[number];
export const isStatsRange = (v: unknown): v is StatsRange => typeof v === "string" && (STATS_RANGES as readonly string[]).includes(v);

export type StatsBucket = "day" | "month";
export type StatsWindow = {
  range: StatsRange;
  /** সীমা দুটোই অন্তর্ভুক্ত, "YYYY-MM-DD" */
  from: string;
  to: string;
  /** আগের-সমান-সময় (শুধু 'সব সময়'-এ নেই) */
  prev: { from: string; to: string } | null;
  bucket: StatsBucket;
};

const ALL_FROM = "1970-01-01";
const pad = (n: number) => String(n).padStart(2, "0");
const parse = (d: string): { y: number; m: number; day: number } => {
  const [y, m, day] = d.split("-").map(Number);
  return { y: y!, m: m!, day: day! };
};
const fmt = (ms: number): string => {
  const x = new Date(ms);
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
};

/** "YYYY-MM-DD" ± n দিন (calendar-arithmetic, timezone-মুক্ত) */
export function addDays(day: string, n: number): string {
  const { y, m, day: d } = parse(day);
  return fmt(Date.UTC(y, m - 1, d + n));
}

/** মাসের প্রথম দিন, n মাস আগে/পরে */
function firstOfMonth(day: string, monthOffset: number): string {
  const { y, m } = parse(day);
  return fmt(Date.UTC(y, m - 1 + monthOffset, 1));
}

/** পরিসর → আজ-ভিত্তিক সীমা ও আগের-সমান-সময়। 12m = চলতি মাসসহ ১২ মাস (মাসের শুরু থেকে) */
export function statsWindow(range: StatsRange, nowMs: number, timeZone: string): StatsWindow {
  const today = dayKey(nowMs, timeZone);
  switch (range) {
    case "today":
      return { range, from: today, to: today, prev: { from: addDays(today, -1), to: addDays(today, -1) }, bucket: "day" };
    case "7d":
    case "30d": {
      const n = range === "7d" ? 7 : 30;
      const from = addDays(today, -(n - 1));
      return { range, from, to: today, prev: { from: addDays(from, -n), to: addDays(from, -1) }, bucket: "day" };
    }
    case "12m": {
      const from = firstOfMonth(today, -11);
      return { range, from, to: today, prev: { from: firstOfMonth(today, -23), to: addDays(from, -1) }, bucket: "month" };
    }
    case "all":
      return { range, from: ALL_FROM, to: today, prev: null, bucket: "month" };
  }
}

/** শতকরা পরিবর্তন (পূর্ণসংখ্যা); আগের মান ০/নেই হলে null (তুলনা দেখানো হয় না) */
export function pctChange(cur: number, prev: number | null | undefined): number | null {
  if (prev == null || prev <= 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

export type Point = { k: string; n: number };

/** সীমার সব দিন/মাস-key (ফাঁকা = ০) — চার্টে ফাঁক না থাকার জন্য। 'সব সময়'-এ প্রথম ডেটার মাস থেকে (সর্বোচ্চ ১২০ মাস) */
export function fillBuckets(rows: readonly Point[], w: Pick<StatsWindow, "from" | "to" | "bucket" | "range">): Point[] {
  const byKey = new Map(rows.map((r) => [r.k, r.n] as const));
  const out: Point[] = [];
  if (w.bucket === "day") {
    for (let d = w.from, i = 0; d <= w.to && i < 400; d = addDays(d, 1), i++) out.push({ k: d, n: byKey.get(d) ?? 0 });
    return out;
  }
  let start = w.from;
  if (w.range === "all") {
    const first = rows.map((r) => r.k).sort()[0];
    if (!first) return [];
    start = `${first}-01`;
  }
  let cur = firstOfMonth(start, 0);
  const last = firstOfMonth(w.to, 0);
  const monthKey = (d: string) => d.slice(0, 7);
  for (let i = 0; cur <= last && i < 120; cur = firstOfMonth(cur, 1), i++) out.push({ k: monthKey(cur), n: byKey.get(monthKey(cur)) ?? 0 });
  return out;
}

const REFERRER_NAMES: readonly [RegExp, string][] = [
  [/(^|\.)google\./, "Google"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|m\.facebook\.com|l\.facebook\.com|lm\.facebook\.com)$/, "Facebook"],
  [/(^|\.)(bing\.com)$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "X (Twitter)"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "WhatsApp"],
  [/(^|\.)(t\.me|telegram\.org)$/, "Telegram"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "LinkedIn"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(reddit\.com)$/, "Reddit"],
];

/** referrer-hostname → সহজ নাম; `direct` = 'সরাসরি'; অচেনা = ডোমেইনই */
export function referrerLabel(host: string, direct = "সরাসরি"): string {
  if (!host || host === "direct") return direct;
  const h = host.toLowerCase();
  return REFERRER_NAMES.find(([re]) => re.test(h))?.[1] ?? h;
}

/** দুই-অক্ষরের দেশ-কোড → বাংলা নাম (`Intl.DisplayNames`); `XX`/অবৈধ = 'অজানা'; ব্যর্থ হলে কোডই */
export function countryLabel(code: string, unknown = "অজানা"): string {
  if (!/^[A-Za-z]{2}$/.test(code) || code.toUpperCase() === "XX") return unknown;
  try {
    return new Intl.DisplayNames(["bn"], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/** D1 থেকে আসা `total` ইত্যাদি অ-সংখ্যা/ঋণাত্মক হলে ০ (defensive read) */
export const toCount = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/**
 * চার্ট-key → বাংলা লেবেল। key নিজেই সাইট-timezone-এর calendar দিন/মাস, তাই UTC-midnight ধরে format করা timezone-রূপান্তর নয়
 * (শুধু calendar-নাম বের করা) — দিন সরে যায় না।
 */
export function bucketLabel(k: string, bucket: StatsBucket): string {
  const [y, m, d] = k.split("-").map(Number);
  if (!y || !m) return k;
  if (bucket === "month") return formatMonthYear(y, m);
  return new Intl.DateTimeFormat("bn-BD", { timeZone: "UTC", day: "numeric", month: "long" }).format(new Date(Date.UTC(y, m - 1, d ?? 1)));
}
