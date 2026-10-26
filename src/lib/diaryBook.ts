// বছর-শেষের "বই-মলাট": পরিসংখ্যান ও সূচিপত্র এন্ট্রি থেকেই হিসাব (pure, SDK/UI-মুক্ত; কিছু সংরক্ষণ হয় না)।
// PDF (`DiaryPrintRoot`) ও Word (`diaryDocx`) দুটোই এটা ব্যবহার করে।
import { bn } from "../i18n/bn";
import type { DownloadEntry } from "./diaryExport";

export const BOOK_COVERS = ["plain", "navy", "red"] as const;
export type BookCover = (typeof BOOK_COVERS)[number];
export const DEFAULT_BOOK_COVER: BookCover = "plain";

const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });
const wordsOf = (lines: readonly string[]) => lines.join(" ").split(/\s+/).filter(Boolean).length;

/** সবচেয়ে বেশিবার আসা মান; সমান হলে আগে-আসাটা; খালি হলে undefined */
function topOf(values: readonly string[]): string | undefined {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  let best: string | undefined;
  let n = 0;
  for (const [k, c] of m) if (c > n) [best, n] = [k, c];
  return best;
}

export type BookStats = { days: number; places: number; words: number; topPlace?: string; favPeriod?: string };

export function bookStats(entries: readonly DownloadEntry[]): BookStats {
  const locs = entries.map((e) => e.location?.trim() ?? "").filter(Boolean);
  const pers = entries.map((e) => e.period ?? "").filter(Boolean);
  const topPlace = topOf(locs);
  const favPeriod = topOf(pers);
  return {
    days: new Set(entries.map((e) => e.day).filter(Boolean)).size,
    places: new Set(locs).size,
    words: entries.reduce((n, e) => n + wordsOf(e.lines), 0),
    ...(topPlace ? { topPlace } : {}),
    ...(favPeriod ? { favPeriod } : {}),
  };
}

/** মলাটের নিচের ছোট লাইনগুলো (খালি অংশ বাদ) */
export function bookCoverLines(s: BookStats): string[] {
  const L = bn.diary.dl.book;
  return [
    s.days > 0 ? `${L.days(bnNum(s.days))}${s.places > 0 ? ` · ${L.places(bnNum(s.places))}` : ""}` : "",
    s.words > 0 ? L.words(bnNum(s.words)) : "",
    s.topPlace ? L.topPlace(s.topPlace) : "",
    s.favPeriod ? L.favPeriod(s.favPeriod) : "",
  ].filter(Boolean);
}

export type TocRow = { key: string; label: string; count: number };

/** মাসভিত্তিক সূচি (দিন-ক্রমে); একাধিক বছর থাকলে লেবেলে বছরও */
export function bookToc(entries: readonly DownloadEntry[]): TocRow[] {
  const valid = entries.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.day));
  const years = new Set(valid.map((e) => e.day.slice(0, 4)));
  const rows = new Map<string, TocRow>();
  for (const e of [...valid].sort((a, b) => a.day.localeCompare(b.day))) {
    const key = e.day.slice(0, 7);
    const hit = rows.get(key);
    if (hit) hit.count += 1;
    else {
      const m = bn.diary.months[Number(key.slice(5, 7)) - 1] ?? "";
      rows.set(key, { key, label: years.size > 1 ? `${m} ${bnNum(Number(key.slice(0, 4)))}` : m, count: 1 });
    }
  }
  return [...rows.values()];
}

/** বইয়ের মেরুদণ্ডে/মলাটে বছর-লাইন: একই বছর হলে "২০২৬", নইলে "২০২৪–২০২৬" */
export function bookYears(entries: readonly DownloadEntry[]): string {
  const ys = entries.map((e) => Number(e.day.slice(0, 4))).filter((y) => y >= 1900 && y < 3000);
  if (ys.length === 0) return "";
  const a = Math.min(...ys);
  const b = Math.max(...ys);
  return a === b ? bnNum(a) : `${bnNum(a)}–${bnNum(b)}`;
}
