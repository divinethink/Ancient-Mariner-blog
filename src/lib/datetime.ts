// সব তারিখ-সময় প্রদর্শন ও 'দিন'-গণনা শুধু এখান দিয়ে (Dev Rule ১৫, Arch §৮)।
// সংরক্ষণ UTC; প্রদর্শন সাইট-timezone-এ (শুরুর Asia/Dhaka)।
export const DEFAULT_TIMEZONE = "Asia/Dhaka";

type DateInput = Date | string | number;
const toDate = (d: DateInput) => (d instanceof Date ? d : new Date(d));

/** তারিখ, বাংলায়: "৪ অক্টোবর ২০২৬" */
export function formatDate(d: DateInput, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("bn-BD", { timeZone, dateStyle: "long" }).format(toDate(d));
}

/** তারিখ-ব্যাজের জন্য দিন ও মাস আলাদা: { day: "৪", month: "অক্টো" } */
export function formatDayMonth(d: DateInput, timeZone = DEFAULT_TIMEZONE): { day: string; month: string } {
  const parts = new Intl.DateTimeFormat("bn-BD", { timeZone, day: "numeric", month: "short" }).formatToParts(toDate(d));
  const pick = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return { day: pick("day"), month: pick("month") };
}

/** তারিখ ও সময়, বাংলায় */
export function formatDateTime(d: DateInput, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("bn-BD", {
    timeZone,
    dateStyle: "long",
    timeStyle: "short",
  }).format(toDate(d));
}

/** সংক্ষিপ্ত তারিখ-সময় (বছর ছাড়া), বাংলায়: "১২ অক্টোবর, ১১:৩৭ AM" (তারিখ ও সময় আলাদা করে জোড়া — 'এ' সংযোজক এড়াতে) */
export function formatShortDateTime(d: DateInput, timeZone = DEFAULT_TIMEZONE): string {
  const date = new Intl.DateTimeFormat("bn-BD", { timeZone, day: "numeric", month: "long" }).format(toDate(d));
  const time = new Intl.DateTimeFormat("bn-BD", { timeZone, hour: "numeric", minute: "2-digit" }).format(toDate(d)).replace(/\s/g, "\u00A0"); // AM/PM আলাদা লাইনে না ভাঙতে
  return `${date}, ${time}`;
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

const pad = (n: number) => String(n).padStart(2, "0");

/** UTC ms → সাইট-timezone-এর "YYYY-MM-DDTHH:mm" (datetime-local ইনপুটের মান) */
export function toZonedInput(d: DateInput, timeZone = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    numberingSystem: "latn",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(toDate(d));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** সাইট-timezone-এর "YYYY-MM-DDTHH:mm" → UTC Date; অবৈধ হলে null (DST-সহ দুইবার offset সমন্বয়) */
export function fromZonedInput(s: string, timeZone = DEFAULT_TIMEZONE): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(wall)) return null;
  let guess = wall;
  for (let i = 0; i < 2; i++) {
    const shown = toZonedInput(guess, timeZone);
    const sm = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(shown);
    if (!sm) return null;
    const [sy, smo, sd, sh, smi] = sm.slice(1).map(Number);
    guess += wall - Date.UTC(sy, smo - 1, sd, sh, smi);
  }
  const out = new Date(guess);
  return toZonedInput(out, timeZone) === `${m[1]}-${m[2]}-${m[3]}T${pad(h)}:${pad(mi)}` ? out : null;
}

/** "Asia/Dhaka (GMT+6)" — Settings-এর timezone-তালিকার লেবেল; offset না পেলে শুধু id */
export function tzLabel(timeZone: string, at: DateInput = new Date()): string {
  try {
    const off = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(toDate(at))
      .find((p) => p.type === "timeZoneName")?.value;
    return off ? `${timeZone} (${off})` : timeZone;
  } catch {
    return timeZone;
  }
}

/** মাসের লেবেল, বাংলায়: "সেপ্টেম্বর ২০২৬" (y, m = ১–১২; ক্যালেন্ডার-মাস, তাই timezone-নিরপেক্ষ — Archive/পঞ্জিকা) */
export function formatMonthYear(y: number, m: number): string {
  return new Intl.DateTimeFormat("bn-BD", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 15)));
}
