// পাবলিক "দিনলিপি পঞ্জিকা"-র pure অংশ (SDK/UI-মুক্ত): দিন-গ্রুপ, হিটম্যাপ-স্তর, মাসের ছক, প্রথম-৫০-লাইন প্রিভিউ।
// 'দিন' = diary-র `date` ("YYYY-MM-DD", সাইট-timezone); না থাকলে publishedAt/createdAt-এর সাইট-timezone-দিন।
import { dayKey, formatMonthYear } from "./datetime";
import { isValidDayKey } from "./diary";
import { docToText, parseBody, type DocNode } from "./editorDoc";

export const DIARY_PATH = "/diary";
export const DIARY_PREVIEW_LINES = 50;
export const DIARY_FEED_PATH = "/diary/feed.xml";
/** ASCII পথ: /diary/2026-10-10 (বাংলা অঙ্ক নয়) */
export const diaryDayPath = (day: string): string => `${DIARY_PATH}/${day}`;

export type DiaryEntry = { id: string; day: string; title: string; body: string; words: number; at: number };
type DiaryPostLike = { id: string; title: string; body: string; wordCount: number; date?: string; publishedAt?: Date; createdAt: Date };

/** দিন-key: বৈধ `date` আগে; নইলে publishedAt → createdAt */
export function entryDay(p: Pick<DiaryPostLike, "date" | "publishedAt" | "createdAt">, timeZone: string): string {
  if (p.date && isValidDayKey(p.date)) return p.date;
  return dayKey(p.publishedAt ?? p.createdAt, timeZone);
}

/** diary লেখা → দিন-অনুযায়ী গ্রুপ; একই দিনে একাধিক হলে পুরনো আগে (লেখার ক্রমে) */
export function groupByDay(posts: readonly DiaryPostLike[], timeZone: string): Map<string, DiaryEntry[]> {
  const out = new Map<string, DiaryEntry[]>();
  for (const p of posts) {
    const day = entryDay(p, timeZone);
    const e: DiaryEntry = { id: p.id, day, title: p.title, body: p.body, words: p.wordCount, at: (p.publishedAt ?? p.createdAt).getTime() };
    const l = out.get(day);
    if (l) l.push(e);
    else out.set(day, [e]);
  }
  for (const l of out.values()) l.sort((a, b) => a.at - b.at);
  return out;
}

/** হিটম্যাপ-স্তর ০..৪: ০ = লেখা নেই; শব্দসংখ্যা বাড়লে গাঢ় (লেখা থাকলে কমপক্ষে ১) */
export function heatLevel(words: number, hasEntry = true): 0 | 1 | 2 | 3 | 4 {
  if (!hasEntry) return 0;
  if (words <= 60) return 1;
  if (words <= 150) return 2;
  if (words <= 300) return 3;
  return 4;
}

export type DiaryCell = { day: number; key: string; level: 0 | 1 | 2 | 3 | 4; href?: string };
export type DiaryMonthView = {
  ym: string;
  label: string;
  /** মাসের ১ তারিখের আগে ফাঁকা ঘর (সপ্তাহ রবিবার থেকে) */
  lead: number;
  cells: DiaryCell[];
  /** লেখা-আছে এমন কাছের আগের/পরের মাসের একটা দিনের পথ (static লিংক) */
  prev?: string;
  next?: string;
};

/** ym ("YYYY-MM") মাসের ছক। `days` = লেখা-আছে এমন সব দিন → তাদের মোট শব্দ */
export function buildDiaryMonth(days: ReadonlyMap<string, number>, ym: string): DiaryMonthView {
  const [y, m] = ym.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: DiaryCell[] = [];
  for (let d = 1; d <= count; d++) {
    const key = `${ym}-${String(d).padStart(2, "0")}`;
    const w = days.get(key);
    cells.push(w === undefined ? { day: d, key, level: 0 } : { day: d, key, level: heatLevel(w), href: diaryDayPath(key) });
  }
  const keys = [...days.keys()].sort();
  const before = keys.filter((k) => k < `${ym}-01`).pop();
  const after = keys.find((k) => k > `${ym}-31`);
  return {
    ym,
    label: formatMonthYear(y, m),
    lead: new Date(Date.UTC(y, m - 1, 1)).getUTCDay(),
    cells,
    ...(before && { prev: diaryDayPath(before) }),
    ...(after && { next: diaryDayPath(after) }),
  };
}

/** সর্বশেষ দিন (লেখা-আছে এমন); না থাকলে undefined */
export const latestDay = (days: Iterable<string>): string | undefined => [...days].sort().pop();

/** body-র প্রথম `max`টি অ-খালি লাইন (প্যারাগ্রাফ/আইটেম); বাকি থাকলে truncated=true। body = সংরক্ষিত Tiptap-JSON string */
export function diaryPreview(body: string, max = DIARY_PREVIEW_LINES): { body: string; truncated: boolean } {
  const doc = parseBody(body);
  const nodes = doc.content ?? [];
  const kept: DocNode[] = [];
  let lines = 0;
  let truncated = false;
  for (const n of nodes) {
    const filled = docToText({ type: "doc", content: [n] }) !== "";
    if (filled && lines >= max) {
      truncated = true;
      break;
    }
    kept.push(n);
    if (filled) lines += 1;
  }
  return { body: JSON.stringify({ type: "doc", content: kept.length ? kept : [{ type: "paragraph" }] }), truncated };
}

const dayNum = (key: string): number => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

export type StreakStats = { total: number; longest: number; /** সর্বশেষ লেখা-দিনে শেষ হওয়া টানা-সারি */ latest: number };

/** লেখা-আছে এমন দিনগুলো থেকে: মোট দিন, সর্বোচ্চ টানা, সর্বশেষ টানা। build-তারিখ-নিরপেক্ষ (static পেজ পুরনো হলেও ভুল হয় না) */
export function streakStats(days: Iterable<string>): StreakStats {
  const nums = [...new Set(days)].sort().map(dayNum);
  let longest = 0;
  let run = 0;
  nums.forEach((n, i) => {
    run = i > 0 && n - nums[i - 1] === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  });
  return { total: nums.length, longest, latest: run };
}

/** লেখা-আছে এমন বছর, নতুন আগে */
export const diaryYears = (days: Iterable<string>): number[] => [...new Set([...days].map((d) => Number(d.slice(0, 4))))].sort((a, b) => b - a);

export const diaryYearPath = (y: number): string => `${DIARY_PATH}/year/${y}`;

/** আগের/পরের লেখা-আছে এমন দিন (পাথ নয়, দিন-key) */
export function adjacentDays(days: Iterable<string>, day: string): { prev?: string; next?: string } {
  const all = [...days].sort();
  return { prev: all.filter((d) => d < day).pop(), next: all.find((d) => d > day) };
}

/** 'এই দিনে': আজের (MM-DD) সাথে মেলে এমন আগের বছরের দিনগুলো, নতুন আগে */
export function sameDayEarlier(days: Iterable<string>, today: string): string[] {
  const md = today.slice(5);
  return [...days].filter((d) => d.slice(5) === md && d.slice(0, 4) < today.slice(0, 4)).sort().reverse();
}

export type YearCell = { key: string; level: 0 | 1 | 2 | 3 | 4 } | null;
export type YearView = {
  year: number;
  /** প্রতি সপ্তাহ = ৭ ঘর (রবি→শনি); বছরের বাইরের ঘর null */
  weeks: YearCell[][];
  /** মাসের লেবেল: কোন সপ্তাহ-কলামে শুরু; লেখা থাকলে সেই মাসের প্রথম লেখা-দিনের পথ */
  months: { label: string; col: number; href?: string }[];
  writtenDays: number;
};

/** বছরের হিটম্যাপ-ছক (GitHub-স্টাইল)। `days` = লেখা-আছে এমন দিন → মোট শব্দ */
export function buildYearView(days: ReadonlyMap<string, number>, year: number): YearView {
  const first = new Date(Date.UTC(year, 0, 1));
  const total = Math.round((Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000);
  const cells: YearCell[] = Array.from({ length: first.getUTCDay() }, () => null);
  const months: YearView["months"] = [];
  const fmt = new Intl.DateTimeFormat("bn-BD", { month: "short", timeZone: "UTC" });
  let written = 0;
  for (let i = 0; i < total; i++) {
    const d = new Date(Date.UTC(year, 0, 1 + i));
    const key = d.toISOString().slice(0, 10);
    const w = days.get(key);
    if (w !== undefined) written += 1;
    if (d.getUTCDate() === 1) {
      const ym = key.slice(0, 7);
      const firstWritten = [...days.keys()].filter((k) => k.startsWith(ym)).sort()[0];
      months.push({ label: fmt.format(d), col: Math.floor(cells.length / 7), ...(firstWritten && { href: diaryDayPath(firstWritten) }) });
    }
    cells.push({ key, level: w === undefined ? 0 : heatLevel(w) });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: YearCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { year, weeks, months, writtenDays: written };
}
