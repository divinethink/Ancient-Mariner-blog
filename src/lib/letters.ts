// ভবিষ্যতের চিঠি (দিনলিপি-গ): pure (SDK/UI-মুক্ত)। তারিখ-সময় শুধু সাইট-timezone দিয়ে (Dev Rule ১৫); সংরক্ষণ UTC।
// তালা শুধু UI-তে — Firestore/ব্যাকআপে লেখা সাধারণ থাকে (owner-অনুমোদিত সীমা)।
import { dayKey, fromZonedInput } from "./datetime";

export const LETTER_TITLE_MAX = 100;
export const LETTER_BODY_MAX = 20_000;
export const LETTER_LIST_MAX = 200;
export const LETTER_MAX_YEAR = 2100;
const DAY_MS = 86_400_000;

const keyMs = (k: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : Number.NaN;
};

/** দিন-key-এ n দিন যোগ ("YYYY-MM-DD"); অবৈধ key হলে অপরিবর্তিত */
export function addDays(key: string, n: number): string {
  const ms = keyMs(key);
  return Number.isNaN(ms) ? key : new Date(ms + n * DAY_MS).toISOString().slice(0, 10);
}

/** খোলার সবচেয়ে আগের অনুমোদিত দিন = সাইট-timezone-এর আগামীকাল */
export const minLetterDay = (now: number, tz: string): string => addDays(dayKey(now, tz), 1);

/** বৈধ তারিখ, আগামীকাল বা পরের, ২১০০-এর মধ্যে (যেমন ২০২৬-০২-৩০ অবৈধ) */
export function isValidLetterDay(day: string, now: number, tz: string): boolean {
  const ms = keyMs(day);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== day) return false;
  return day >= minLetterDay(now, tz) && Number(day.slice(0, 4)) <= LETTER_MAX_YEAR;
}

/** দিন-key → সেই দিনের শুরু (সাইট-timezone, 00:00) UTC Date; অবৈধ হলে null */
export function openAtFor(day: string, now: number, tz: string): Date | null {
  return isValidLetterDay(day, now, tz) ? fromZonedInput(`${day}T00:00`, tz) : null;
}

export const isLetterOpen = (openAt: Date, now: number): boolean => openAt.getTime() <= now;

/** তালাবদ্ধ থাকলে ন্যূনতম ১; খোলা হলে ০ (সাইট-timezone-এর দিন গুনে) */
export function letterDaysLeft(openAt: Date, now: number, tz: string): number {
  if (isLetterOpen(openAt, now)) return 0;
  const d = Math.round((keyMs(dayKey(openAt, tz)) - keyMs(dayKey(now, tz))) / DAY_MS);
  return Math.max(1, Number.isNaN(d) ? 1 : d);
}
