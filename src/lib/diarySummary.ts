// পাবলিক দিনলিপির 'বছরের সারসংক্ষেপ' ও 'জায়গার তালিকা' (দিনলিপি-খ): pure (SDK/UI-মুক্ত), build-সময়ের একই ডেটা থেকে — নতুন read/schema নেই।
// ইনপুট শুধু প্রকাশিত+public দিনলিপি (`getPublicDiary`), তাই ব্যক্তিগত লেখার স্থান কখনো আসে না।
import type { DiaryEntry } from "./diaryCalendar";

export const PLACES_PATH = "/diary/places";

/** জায়গার নাম একরূপ করা: NFC, ZWJ/ZWNJ-সহ নয় শুধু বাড়তি ফাঁকা ছাঁটা; খালি হলে null */
export function normPlace(raw: string | undefined): string | null {
  const s = (raw ?? "").normalize("NFC").replace(/\s+/gu, " ").trim();
  return s === "" ? null : s;
}

export type PlaceStat = { name: string; count: number; days: string[] };
export type YearSummary = {
  year: number;
  /** যত দিন লেখা হয়েছে */
  days: number;
  entries: number;
  words: number;
  /** সবচেয়ে লম্বা একক লেখা; লেখা না থাকলে undefined */
  longest?: { day: string; words: number };
  /** যে মাসে সবচেয়ে বেশি দিন লেখা (সমান হলে আগের মাস) */
  busiestMonth?: { month: number; days: number };
  places: PlaceStat[];
};

/** জায়গা → কতবার/কোন দিনে। বেশি আগে, সমান হলে নামের ক্রমে; `year` দিলে শুধু সেই বছর। একই দিনে একই জায়গা একবারই গোনা */
export function placeStats(byDay: ReadonlyMap<string, readonly DiaryEntry[]>, year?: number): PlaceStat[] {
  const m = new Map<string, Set<string>>();
  for (const [day, es] of byDay) {
    if (year !== undefined && Number(day.slice(0, 4)) !== year) continue;
    for (const e of es) {
      const p = normPlace(e.location);
      if (!p) continue;
      const set = m.get(p) ?? new Set<string>();
      set.add(day);
      m.set(p, set);
    }
  }
  return [...m]
    .map(([name, set]) => ({ name, count: set.size, days: [...set].sort() }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "bn"));
}

export function summarizeYear(byDay: ReadonlyMap<string, readonly DiaryEntry[]>, year: number): YearSummary {
  let days = 0;
  let entries = 0;
  let words = 0;
  let longest: YearSummary["longest"];
  const perMonth = new Array<number>(12).fill(0);
  for (const [day, es] of [...byDay].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (Number(day.slice(0, 4)) !== year || es.length === 0) continue;
    days += 1;
    perMonth[Number(day.slice(5, 7)) - 1]! += 1;
    for (const e of es) {
      entries += 1;
      words += e.words;
      if (!longest || e.words > longest.words) longest = { day, words: e.words };
    }
  }
  let busiestMonth: YearSummary["busiestMonth"];
  for (let i = 0; i < 12; i++) {
    const n = perMonth[i]!;
    if (n > (busiestMonth?.days ?? 0)) busiestMonth = { month: i + 1, days: n };
  }
  return { year, days, entries, words, ...(longest && { longest }), ...(busiestMonth && { busiestMonth }), places: placeStats(byDay, year) };
}
