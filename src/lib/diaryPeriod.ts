// লেখার সময় → "বেলা" (সকাল/দুপুর/বিকাল/সন্ধ্যা/রাত)। pure; নিজে-নিজে হিসাব, কিছু সংরক্ষণ হয় না।
// সকাল ০৫–১১ · দুপুর ১২–১৫ · বিকাল ১৬–১৭ · সন্ধ্যা ১৮–১৯ · রাত ২০–০৪ (সাইটের timezone অনুযায়ী ঘণ্টা)
export type DayPeriod = "morning" | "noon" | "afternoon" | "evening" | "night";

export function hourIn(at: Date | number, timeZone: string): number {
  const d = typeof at === "number" ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return NaN;
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(d));
  return Number.isFinite(h) ? h % 24 : NaN;
}

/** ঘণ্টা না পেলে (অবৈধ সময়/timezone) null — চিপ দেখানো হয় না */
export function periodOf(at: Date | number | undefined, timeZone: string): DayPeriod | null {
  if (at === undefined) return null;
  let h: number;
  try {
    h = hourIn(at, timeZone);
  } catch {
    return null;
  }
  if (!Number.isFinite(h)) return null;
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 16) return "noon";
  if (h >= 16 && h < 18) return "afternoon";
  if (h >= 18 && h < 20) return "evening";
  return "night";
}
