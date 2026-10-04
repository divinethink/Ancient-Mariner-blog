// সব তারিখ-সময় প্রদর্শন ও 'দিন'-গণনা শুধু এখান দিয়ে (Dev Rule ১৫, Arch §৮)।
// সংরক্ষণ UTC; প্রদর্শন সাইট-timezone-এ (শুরুর Asia/Dhaka)।
export const DEFAULT_TIMEZONE = "Asia/Dhaka";

type DateInput = Date | string | number;
const toDate = (d: DateInput) => (d instanceof Date ? d : new Date(d));

/** তারিখ, বাংলায়: "৪ অক্টোবর ২০২৬" */
export function formatDate(d: DateInput, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("bn-BD", { timeZone, dateStyle: "long" }).format(toDate(d));
}

/** তারিখ ও সময়, বাংলায় */
export function formatDateTime(d: DateInput, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("bn-BD", {
    timeZone,
    dateStyle: "long",
    timeStyle: "short",
  }).format(toDate(d));
}

/** সাইট-timezone-এর 'দিন'-key: ASCII "YYYY-MM-DD" (দৈনিক-লক্ষ্য, diary, archive, D1 dedupe-এর ভিত্তি) */
export function dayKey(d: DateInput, timeZone = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(toDate(d));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
