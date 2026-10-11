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
