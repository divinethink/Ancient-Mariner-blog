// সাপ্তাহিক পর্যালোচনা (দিনলিপি-ছ): সপ্তাহ = রবিবার–শনিবার (পঞ্জিকার মতো)। pure; দিন-key "YYYY-MM-DD" (সাইট-timezone-এর দিন — Dev Rule ১৫)।
import { addDays } from "./letters";

/** দিন-key-র বার: ০ = রবিবার … ৬ = শনিবার; অবৈধ key-তে ০ */
export function weekdayOf(key: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay() : 0;
}

/** `day`-এর সপ্তাহ (offset ±n সপ্তাহ সরানো): রবিবার ও শনিবারের দিন-key */
export function weekRange(day: string, offset = 0): { from: string; to: string } {
  const from = addDays(day, -weekdayOf(day) + Math.trunc(offset) * 7);
  return { from, to: addDays(from, 6) };
}

/** দিন-key সীমার (সহ) ভেতরে কি */
export const inRange = (day: string | undefined, from: string, to: string): boolean => day !== undefined && day >= from && day <= to;
