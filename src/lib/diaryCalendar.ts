// পাবলিক "দিনলিপি পঞ্জিকা"-র pure অংশ (SDK/UI-মুক্ত): দিন-গ্রুপ, হিটম্যাপ-স্তর, মাসের ছক, প্রথম-~৩০-শব্দ প্রিভিউ।
// 'দিন' = diary-র `date` ("YYYY-MM-DD", সাইট-timezone); না থাকলে publishedAt/createdAt-এর সাইট-timezone-দিন।
import { dayKey, formatMonthYear } from "./datetime";
import { isValidDayKey } from "./diary";
import { countWords, docToText, parseBody, type DocNode } from "./editorDoc";

export const DIARY_PATH = "/diary";
/** প্রিভিউ-সীমা: প্রায় এত শব্দ, নিকটতম দাঁড়ি (।?!.)-তে বাক্য ভেঙে নয় */
export const DIARY_PREVIEW_WORDS = 30;
export const DIARY_FEED_PATH = "/diary/feed.xml";
/** ASCII পথ: /diary/2026-10-10 (বাংলা অঙ্ক নয়) */
export const diaryDayPath = (day: string): string => `${DIARY_PATH}/${day}`;

export type DiaryEntry = { id: string; day: string; title: string; body: string; words: number; at: number; location?: string; theme?: string };
type DiaryPostLike = { id: string; title: string; body: string; wordCount: number; date?: string; location?: string; publishedAt?: Date; createdAt: Date; diaryTheme?: string };

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
    const e: DiaryEntry = { id: p.id, day, title: p.title, body: p.body, words: p.wordCount, at: (p.publishedAt ?? p.createdAt).getTime(), ...(p.location && { location: p.location }), ...(p.diaryTheme && { theme: p.diaryTheme }) };
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

type PNode = DocNode;
const SENT_END = /[।?!.]/u;

/** paragraph-এর সরাসরি text/hardBreak সন্তান → `cut` অক্ষর পর্যন্ত কেটে (mark অক্ষত) + ঐচ্ছিক "…" */
function sliceInline(kids: readonly PNode[], cut: number, ellipsis: boolean): PNode[] {
  const out: PNode[] = [];
  let used = 0;
  for (const k of kids) {
    const len = k.type === "text" ? (k.text ?? "").length : 1;
    if (used + len <= cut) out.push(k);
    else if (k.type === "text" && cut > used) out.push({ ...k, text: (k.text ?? "").slice(0, cut - used) });
    used += len;
    if (used >= cut) break;
  }
  if (ellipsis) out.push({ type: "text", text: "…" });
  return out;
}

/** body-র প্রথম ~`maxWords` শব্দ, নিকটতম দাঁড়িতে কাটা; বাকি থাকলে truncated=true। body = সংরক্ষিত Tiptap-JSON string।
 *  প্রথম বাক্যই সীমার বেশি লম্বা হলে শব্দ-সীমায় কেটে "…" যোগ হয়। */
export function diaryPreview(body: string, maxWords = DIARY_PREVIEW_WORDS): { body: string; truncated: boolean } {
  const nodes = parseBody(body).content ?? [];
  const kept: PNode[] = [];
  let used = 0;
  let truncated = false;
  for (const n of nodes) {
    const text = docToText({ type: "doc", content: [n] });
    const w = countWords(text);
    if (w === 0) {
      kept.push(n);
      continue;
    }
    if (used + w <= maxWords) {
      kept.push(n);
      used += w;
      continue;
    }
    truncated = true;
    const kids = n.content ?? [];
    if (n.type === "paragraph" && kids.every((k) => k.type === "text" || k.type === "hardBreak")) {
      const flat = kids.map((k) => (k.type === "text" ? (k.text ?? "") : "\n")).join("");
      const rem = maxWords - used;
      const ends = [...flat.matchAll(/\S+/gu)];
      const limit = rem > 0 && ends[rem - 1] ? ends[rem - 1].index! + ends[rem - 1][0].length : 0;
      const head = flat.slice(0, limit);
      let cut = -1;
      for (let i = head.length - 1; i >= 0; i--) if (SENT_END.test(head[i]) && countWords(head.slice(0, i + 1)) > 0) { cut = i + 1; break; }
      if (cut > 0) kept.push({ ...n, content: sliceInline(kids, cut, false) });
      else if (used === 0 && limit > 0) kept.push({ ...n, content: sliceInline(kids, limit, true) });
    } else if (used === 0) kept.push(n); // তালিকা/শিরোনাম-জাতীয় প্রথম ব্লক: পুরোটা (বিরল)
    break;
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
