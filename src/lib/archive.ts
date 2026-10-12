// পাবলিক Archive ও পঞ্জিকার pure সহায়ক (Arch §১৭ P10a)। build-ডেটার card (`dateISO`) থেকে সাইট-timezone-এ মাস/দিন-গ্রুপ —
// আলাদা query/index নেই। SDK/UI-মুক্ত; তারিখ-গণনা `lib/datetime.ts` দিয়ে (Dev Rule ১৫)।
import { dayKey, formatMonthName, formatMonthYear } from "./datetime";

export type DatedRef = { dateISO?: string; href: string };
export type MonthRef = { y: number; m: number };
export type ArchiveMonth = MonthRef & { key: string; path: string; label: string; count: number };

const pad2 = (n: number) => String(n).padStart(2, "0");

/** ASCII পথ: /archive/2026/09 (বাংলা অঙ্ক নয়) */
export const archivePath = (y: number, m: number): string => `/archive/${y}/${pad2(m)}`;
export const monthKey = (y: number, m: number): string => `${y}-${pad2(m)}`;
/** card-JSON chunk-ফাইলের নামে নিরাপদ key (`a-2026-09`) */
export const archiveScopeKey = (y: number, m: number): string => `a-${monthKey(y, m)}`;

/** সাইট-timezone-এর "YYYY-MM-DD"; তারিখ না থাকলে/অবৈধ হলে null */
function dayOf(dateISO: string | undefined, timeZone: string): string | null {
  if (!dateISO) return null;
  try {
    return dayKey(dateISO, timeZone);
  } catch {
    return null;
  }
}

/** route param ("2026", "09") → মাস; অবৈধ হলে null */
export function parseMonthParams(year: string, month: string): MonthRef | null {
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) return null;
  const y = Number(year);
  const m = Number(month);
  return m >= 1 && m <= 12 ? { y, m } : null;
}

/** মাস অনুযায়ী গ্রুপ; ইনপুটের ক্রম (publishedAt desc) প্রতি মাসের ভেতরে অক্ষত; তারিখহীনরা বাদ */
export function groupByMonth<T extends DatedRef>(refs: readonly T[], timeZone: string): Map<string, { y: number; m: number; items: T[] }> {
  const out = new Map<string, { y: number; m: number; items: T[] }>();
  for (const r of refs) {
    const d = dayOf(r.dateISO, timeZone);
    if (!d) continue;
    const y = Number(d.slice(0, 4));
    const m = Number(d.slice(5, 7));
    const key = monthKey(y, m);
    const g = out.get(key);
    if (g) g.items.push(r);
    else out.set(key, { y, m, items: [r] });
  }
  return out;
}

/** লেখা-আছে এমন মাসগুলো, নতুন থেকে পুরনো */
export function archiveMonths(refs: readonly DatedRef[], timeZone: string): ArchiveMonth[] {
  return [...groupByMonth(refs, timeZone).values()]
    .sort((a, b) => b.y - a.y || b.m - a.m)
    .map((g) => ({ y: g.y, m: g.m, key: monthKey(g.y, g.m), path: archivePath(g.y, g.m), label: formatMonthYear(g.y, g.m), count: g.items.length }));
}

export type ArchiveYear = { y: number; count: number; months: (ArchiveMonth & { name: string })[] };

/** বছরভিত্তিক আর্কাইভ (sidebar): বছর নতুন→পুরনো, প্রতি বছরের ভেতরে মাস নতুন→পুরনো; count = বছরের মোট লেখা */
export function archiveYears(refs: readonly DatedRef[], timeZone: string): ArchiveYear[] {
  const out = new Map<number, ArchiveYear>();
  for (const m of archiveMonths(refs, timeZone)) {
    const y = out.get(m.y) ?? { y: m.y, count: 0, months: [] };
    y.count += m.count;
    y.months.push({ ...m, name: formatMonthName(m.m) });
    out.set(m.y, y);
  }
  return [...out.values()].sort((a, b) => b.y - a.y);
}

export type CalendarCell = { day: number; href?: string };
export type CalendarView = {
  y: number;
  m: number;
  label: string;
  /** মাসের ১ তারিখের আগে কতগুলো ফাঁকা ঘর (সপ্তাহ রবিবার থেকে) */
  lead: number;
  cells: CalendarCell[];
  /** লেখা-আছে এমন সবচেয়ে কাছের আগের/পরের মাসের archive-পথ (static লিংক, JS ছাড়া) */
  prev?: string;
  next?: string;
};

/**
 * y/m মাসের পঞ্জিকা। যে দিনে ঠিক একটা লেখা → সেই লেখায়; একাধিক → মাসের archive-এ; নইলে লিংক নেই।
 */
export function buildCalendar(refs: readonly DatedRef[], timeZone: string, y: number, m: number): CalendarView {
  const perDay = new Map<number, DatedRef[]>();
  const group = groupByMonth(refs, timeZone).get(monthKey(y, m));
  for (const r of group?.items ?? []) {
    const d = Number(dayOf(r.dateISO, timeZone)?.slice(8, 10));
    const l = perDay.get(d);
    if (l) l.push(r);
    else perDay.set(d, [r]);
  }
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: CalendarCell[] = [];
  for (let d = 1; d <= days; d++) {
    const l = perDay.get(d);
    cells.push(!l ? { day: d } : l.length === 1 ? { day: d, href: l[0].href } : { day: d, href: archivePath(y, m) });
  }
  const key = monthKey(y, m);
  const months = archiveMonths(refs, timeZone); // desc
  const older = months.filter((x) => x.key < key)[0]; // নতুন→পুরনো ক্রমে প্রথম = কাছের আগের
  const newer = [...months].reverse().find((x) => x.key > key); // পুরনো→নতুন ক্রমে প্রথম = কাছের পরের
  return {
    y,
    m,
    label: formatMonthYear(y, m),
    lead: new Date(Date.UTC(y, m - 1, 1)).getUTCDay(),
    cells,
    ...(older && { prev: older.path }),
    ...(newer && { next: newer.path }),
  };
}
