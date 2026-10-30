// বছর-শেষের "বই-মলাট": মলাটের ধরন ও মাসভিত্তিক সূচি এন্ট্রি থেকেই হিসাব (pure, SDK/UI-মুক্ত; কিছু সংরক্ষণ হয় না)।
// PDF (`DiaryPrintRoot`) ও Word (`diaryDocx`) দুটোই এটা ব্যবহার করে।
import { bn } from "../i18n/bn";
import type { DownloadEntry } from "./diaryExport";

export const BOOK_COVERS = ["plain", "navy", "red"] as const;
export type BookCover = (typeof BOOK_COVERS)[number];
export const DEFAULT_BOOK_COVER: BookCover = "plain";

const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });

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
