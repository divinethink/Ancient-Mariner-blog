// বিশেষ দিন (জন্মদিন/বার্ষিকী; দিনলিপি-চ): pure (SDK/UI-মুক্ত)। প্রতি বছর একই মাস-দিনে ফেরে; সব তারিখ দিন-key ("YYYY-MM-DD", সাইট-timezone-এর 'আজ' বাইরে থেকে আসে)।
export const SPECIAL_NAME_MAX = 80;
export const SPECIAL_LIST_MAX = 200;
export const SPECIAL_KIND_LABEL_MAX = 40;
export const SPECIAL_NOTE_MAX = 2000;
export const SPECIAL_YEAR_MIN = 1900;
export const SPECIAL_YEAR_MAX = 2100;
const DAY_MS = 86_400_000;

const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const dim = (m: number, y: number): number => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 0;
const pad = (n: number): string => String(n).padStart(2, "0");
const keyMs = (k: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : Number.NaN;
};

/** মাস ১–১২ ও দিন সেই মাসে সম্ভব কি (২৯ ফেব্রুয়ারি বৈধ — লিপ-বছর ধরে) */
export const validMonthDay = (month: number, day: number): boolean =>
  Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= dim(month, 2000);

/** `todayKey`-এর সমান বা পরের প্রথম পালন-তারিখ। ২৯ ফেব্রুয়ারি নন-লিপ বছরে ২৮ ফেব্রুয়ারিতে পালিত ধরা */
export function nextOccurrence(todayKey: string, month: number, day: number): string {
  const ty = Number(todayKey.slice(0, 4));
  const on = (y: number): string => `${y}-${pad(month)}-${pad(Math.min(day, dim(month, y)))}`;
  const thisYear = on(ty);
  return thisYear >= todayKey ? thisYear : on(ty + 1);
}

export function daysUntil(todayKey: string, month: number, day: number): number {
  return Math.round((keyMs(nextOccurrence(todayKey, month, day)) - keyMs(todayKey)) / DAY_MS);
}

/** পালন-বছর − শুরুর বছর (যেমন বয়স/বার্ষিকী); শুরুর বছর না থাকলে বা ≤০ হলে undefined */
export function yearsAt(occurrenceKey: string, startYear: number | undefined): number | undefined {
  if (startYear === undefined) return undefined;
  const n = Number(occurrenceKey.slice(0, 4)) - startYear;
  return n > 0 ? n : undefined;
}

/** আসন্ন ক্রমে (আগে যেটা আসছে); `withinDays` দিলে শুধু ততদিনের মধ্যে (আজসহ) */
export function sortUpcoming<T extends { month: number; day: number }>(items: readonly T[], todayKey: string, withinDays?: number): (T & { next: string; inDays: number })[] {
  return items
    .map((it) => ({ ...it, next: nextOccurrence(todayKey, it.month, it.day), inDays: daysUntil(todayKey, it.month, it.day) }))
    .filter((it) => withinDays === undefined || it.inDays <= withinDays)
    .sort((a, b) => a.inDays - b.inDays);
}
